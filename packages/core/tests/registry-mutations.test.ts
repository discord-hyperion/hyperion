import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    ChatInputCommandSubcommandGroupBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import { ApplicationCommandType, Collection, REST } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    CommandRegistry,
    defineCommand,
    defineGuard,
    defineParentCommand,
    defineSubcommand,
    defineSubcommandGroup,
    HyperionClient,
    InteractionDispatcher,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");
const credentials = { applicationId: "123", token: "fake-token" };
const imports = `import { defineCommand, defineParentCommand, defineSubcommand, defineSubcommandGroup, defineGuard } from ${JSON.stringify(library)};
import { ChatInputCommandBuilder, ChatInputCommandSubcommandBuilder, ChatInputCommandSubcommandGroupBuilder } from ${JSON.stringify(builders)};
export const calls = [];
const guards = [ctx => {
    calls.push("factory");
    ctx.interaction.events.push("leaf factory");
    return defineGuard({ name: "test-guard", description: "Allowed", run(ctx) { ctx.interaction.events.push("leaf guard"); return true; } });
}];`;
const parentSource = `${imports}
export default defineParentCommand({
    builder: new ChatInputCommandBuilder().setDescription("Tickets"), guards,
})`;
const groupSource = `${imports}
export default defineSubcommandGroup({
    builder: new ChatInputCommandSubcommandGroupBuilder().setDescription("Settings"), guards,
})`;
const leafSource = (name: string) => `${imports}
export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder().setName(${JSON.stringify(name)}).setDescription("Action"), guards,
    async run(ctx) { ctx.interaction.events.push("handler"); await ctx.interaction.reply("done"); },
})`;

const fixture = async (t: TestContext) => {
    const root = await createTempRoot(t, "hyperion-mutations-");
    const files = new Collection<string, string>([
        ["[ticket]/index.mjs", parentSource],
        ["[ticket]/close.mjs", leafSource("close")],
        ["[ticket]/{settings}/index.mjs", groupSource],
        ["[ticket]/{settings}/view.mjs", leafSource("view")],
        ["[ticket]/{settings}/update.mjs", leafSource("update")],
    ]);
    const guardCalls: string[][] = [];
    for (const [file, source] of files) {
        const filename = path.join(root, "src", "commands", file);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, source);
    }
    const registry = new CommandRegistry();
    await registry.load(root);
    for (const file of files.keys()) {
        const module = await import(
            pathToFileURL(path.join(root, "src", "commands", file)).href
        );
        guardCalls.push(module.calls);
    }
    const assertLazy = () => {
        for (const calls of guardCalls) {
            assert.deepEqual(calls, []);
        }
    };
    assertLazy();
    const parent = registry.parents.get("ticket");
    const group = registry.resolveGroup("ticket", "settings");
    const close = registry.resolveSubcommand("ticket", "close");
    const view = registry.resolveSubcommand("ticket", "view", "settings");
    const update = registry.resolveSubcommand("ticket", "update", "settings");
    assert.ok(parent && group && close && view && update);

    return { root, registry, parent, group, close, view, update, assertLazy };
};

type Payload = {
    name: string;
    description?: string;
    type?: number;
    options?: Payload[];
};
const captureRest = (t: TestContext) => {
    const bodies: Payload[][] = [];
    const put = t.mock.method(
        REST.prototype,
        "put",
        async (_route: unknown, options: { body: unknown }) => {
            bodies.push(options.body as Payload[]);

            return [];
        },
    );

    return { bodies, put };
};
const shape = (body: readonly Payload[]): unknown[] =>
    body.map(command => [command.name, shape(command.options ?? [])]);

const standaloneCommand = (name = "ping") =>
    defineCommand({
        builder: new ChatInputCommandBuilder()
            .setName(name)
            .setDescription("Standalone"),
        async run() {},
    });

test("deleting a leaf changes the next deployment without reloading", async t => {
    const { registry, assertLazy } = await fixture(t);
    const { bodies } = captureRest(t);
    await registry.register(credentials);
    assert.deepEqual(shape(bodies[0] ?? []), [
        [
            "ticket",
            [
                ["close", []],
                [
                    "settings",
                    [
                        ["update", []],
                        ["view", []],
                    ],
                ],
            ],
        ],
    ]);

    assert.equal(
        registry.delete(
            CommandRegistry.subcommandKey("ticket", "view", "settings"),
        ),
        true,
    );
    assert.equal(
        registry.resolveSubcommand("ticket", "view", "settings"),
        undefined,
    );
    await registry.register(credentials);
    assert.deepEqual(shape(bodies[1] ?? []), [
        [
            "ticket",
            [
                ["close", []],
                ["settings", [["update", []]]],
            ],
        ],
    ]);
    assertLazy();
});

test("group collisions retain both definition and direct leaf sources", async t => {
    const { root, registry, group, view } = await fixture(t);
    const leaf = path.join(root, "src", "commands", "[ticket]", "settings.mjs");
    const definition = path.join(
        root,
        "src",
        "commands",
        "[ticket]",
        "{settings}",
        "index.mjs",
    );
    await writeFile(leaf, leafSource("settings"));

    await assert.rejects(registry.load(root), error => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(leaf));
        assert.ok(error.message.includes(definition));

        return true;
    });

    assert.equal(registry.resolveGroup("ticket", "settings"), group);
    assert.equal(
        registry.resolveSubcommand("ticket", "view", "settings"),
        view,
    );
});

test("deleting the last grouped leaf omits the unused group and keeps its definition", async t => {
    const { registry, group, parent, assertLazy } = await fixture(t);
    const { bodies } = captureRest(t);
    registry.delete(
        CommandRegistry.subcommandKey("ticket", "view", "settings"),
    );
    registry.delete(
        CommandRegistry.subcommandKey("ticket", "update", "settings"),
    );

    await registry.register(credentials);
    assert.deepEqual(shape(bodies[0] ?? []), [["ticket", [["close", []]]]]);
    assert.equal(registry.resolveGroup("ticket", "settings"), group);
    assert.equal(registry.parents.get("ticket"), parent);
    assert.equal(group.builder.options.length, 0);
    assert.equal(parent.builder.options.length, 0);
    assertLazy();
});

test("replacement parent and group definitions are used by registration and dispatch", async t => {
    const { root } = await fixture(t);

    const client = await HyperionClient.create({
        name: "Mutation test",
        root,
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.commands.load(root);
    const events: string[] = [];
    const factory = (name: string) => () => {
        events.push(`${name} factory`);

        return defineGuard({
            name: "test-guard",
            description: "Allowed",
            run() {
                events.push(`${name} guard`);

                return true;
            },
        });
    };
    const ReplacementParent = defineParentCommand({
        builder: new ChatInputCommandBuilder().setDescription("New parent"),
        guards: [factory("parent")],
    });
    const ReplacementGroup = defineSubcommandGroup({
        builder: new ChatInputCommandSubcommandGroupBuilder().setDescription(
            "New group",
        ),
        guards: [factory("group")],
    });
    const parent = ReplacementParent;
    const group = ReplacementGroup;
    client.commands.parents.set("ticket", parent);
    client.commands.groups.set(
        CommandRegistry.groupKey("ticket", "settings"),
        group,
    );
    assert.equal(client.commands.parents.get("ticket"), parent);
    assert.equal(client.commands.resolveGroup("ticket", "settings"), group);
    const { bodies } = captureRest(t);
    await client.commands.register(credentials);
    assert.equal(bodies[0]?.[0]?.description, "New parent");
    assert.equal(
        bodies[0]?.[0]?.options?.find(option => option.name === "settings")
            ?.description,
        "New group",
    );
    assert.deepEqual(events, []);

    const request = createChatInputInteraction({
        id: "mutation",
        commandName: "ticket",
        options: {
            getSubcommand: () => "view",
            getSubcommandGroup: () => "settings",
        },
        user: { id: "user" },
    });
    Object.assign(request.interaction, { events });
    const { reply } = request;
    await new InteractionDispatcher(client).dispatch(request.interaction);
    assert.deepEqual(events, [
        "parent factory",
        "parent guard",
        "group factory",
        "group guard",
        "leaf factory",
        "leaf guard",
        "handler",
    ]);
    assert.equal(reply.mock.callCount(), 1);
    assert.equal(reply.mock.calls[0]?.arguments[0], "done");
});

for (const definition of ["parent", "group"] as const) {
    test(`removing a ${definition} definition with remaining leaves rejects before REST`, async t => {
        const { registry, assertLazy } = await fixture(t);
        const { put } = captureRest(t);

        if (definition === "parent") {
            registry.parents.delete("ticket");
        } else {
            registry.groups.delete(
                CommandRegistry.groupKey("ticket", "settings"),
            );
        }

        assert.equal(
            registry.resolveSubcommand("ticket", "view", "settings"),
            undefined,
        );

        await assert.rejects(
            registry.register(credentials),
            new RegExp(`no ${definition} definition`, "i"),
        );

        assert.equal(put.mock.callCount(), 0);
        assertLazy();
    });
}

test("clear retains definition collections but protects against an empty deployment", async t => {
    const { registry, parent, group, assertLazy } = await fixture(t);
    const { put } = captureRest(t);
    const parents = registry.parents;
    const groups = registry.groups;
    registry.clear();

    assert.equal(registry.size, 0);
    assert.equal(registry.parents, parents);
    assert.equal(registry.groups, groups);
    assert.deepEqual([...parents], [["ticket", parent]]);
    assert.deepEqual(
        [...groups],
        [[CommandRegistry.groupKey("ticket", "settings"), group]],
    );
    assert.equal(registry.hasSubcommands("ticket"), false);
    await assert.rejects(registry.register(credentials), /empty list/i);
    assert.equal(put.mock.callCount(), 0);
    assertLazy();
});

test("standalone slash and context-menu commands can be inserted with Collection.set", async t => {
    const registry = new CommandRegistry();
    const slash = standaloneCommand("inspect");
    const InspectUser = defineCommand({
        builder: new UserContextCommandBuilder().setName("Inspect"),
        async run() {},
    });
    const menu = InspectUser;
    assert.ok(registry instanceof Collection);
    registry.set(CommandRegistry.key("inspect"), slash);
    registry.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.User),
        menu,
    );
    assert.equal(registry.resolve("inspect"), slash);
    assert.equal(
        registry.resolve("Inspect", ApplicationCommandType.User),
        menu,
    );
    const { bodies } = captureRest(t);

    await registry.register(credentials);
    assert.deepEqual(bodies[0], [
        slash.builder.toJSON(),
        menu.builder.toJSON(),
    ]);
});

test("reinserting discovered leaves retains ancestry and uses current Collection order", async t => {
    const { registry, close, view, update, assertLazy } = await fixture(t);
    registry.clear();
    const standalone = standaloneCommand();
    registry.set("ping", standalone);
    registry.set(
        CommandRegistry.subcommandKey("ticket", "view", "settings"),
        view,
    );
    registry.set(CommandRegistry.subcommandKey("ticket", "close"), close);
    registry.set(
        CommandRegistry.subcommandKey("ticket", "update", "settings"),
        update,
    );
    assert.equal(
        registry.resolveSubcommand("ticket", "view", "settings"),
        view,
    );
    assert.equal(registry.resolveSubcommand("ticket", "close"), close);
    const { bodies } = captureRest(t);

    await registry.register(credentials);
    assert.deepEqual(shape(bodies[0] ?? []), [
        ["ping", []],
        [
            "ticket",
            [
                ["close", []],
                [
                    "settings",
                    [
                        ["view", []],
                        ["update", []],
                    ],
                ],
            ],
        ],
    ]);
    registry.delete("ping");
    registry.set("ping", standalone);
    await registry.register(credentials);
    assert.deepEqual(shape(bodies[1] ?? []), [
        [
            "ticket",
            [
                ["close", []],
                [
                    "settings",
                    [
                        ["view", []],
                        ["update", []],
                    ],
                ],
            ],
        ],
        ["ping", []],
    ]);
    assertLazy();
});

for (const group of [undefined, "settings"]) {
    test(`a new ${group ? "grouped" : "direct"} leaf under a formatted key has no discovered ancestry`, async t => {
        const { registry, assertLazy } = await fixture(t);
        const ManualLeaf = defineSubcommand({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("manual")
                .setDescription("Manual"),
            async run(_ctx) {},
        });
        const manual = ManualLeaf;
        const key = CommandRegistry.subcommandKey("ticket", "manual", group);
        registry.set(key, manual);
        assert.equal(registry.get(key), manual);
        assert.equal(
            registry.resolveSubcommand("ticket", "manual", group),
            undefined,
        );
        const { put } = captureRest(t);

        await assert.rejects(
            registry.register(credentials),
            /no parent definition/i,
        );

        assert.equal(put.mock.callCount(), 0);
        assertLazy();
    });
}

test("mutating builders changes the payload without rekeying discovered handlers", async t => {
    const { registry, view, assertLazy } = await fixture(t);
    const standalone = standaloneCommand();
    registry.set("ping", standalone);
    view.builder.setName("renamed").setDescription("Updated leaf");
    standalone.builder.setName("pong");

    assert.equal(
        registry.resolveSubcommand("ticket", "view", "settings"),
        view,
    );
    assert.equal(
        registry.resolveSubcommand("ticket", "renamed", "settings"),
        undefined,
    );
    assert.equal(registry.resolve("ping"), standalone);
    assert.equal(registry.resolve("pong"), undefined);
    const { bodies } = captureRest(t);
    await registry.register(credentials);
    assert.deepEqual(shape(bodies[0] ?? []), [
        [
            "ticket",
            [
                ["close", []],
                [
                    "settings",
                    [
                        ["update", []],
                        ["renamed", []],
                    ],
                ],
            ],
        ],
        ["pong", []],
    ]);
    assert.equal(
        bodies[0]?.[0]?.options?.find(option => option.name === "settings")
            ?.options?.[1]?.description,
        "Updated leaf",
    );
    assertLazy();
});
