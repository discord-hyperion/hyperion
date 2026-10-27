import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, type TestContext, test } from "node:test";
import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    ChatInputCommandSubcommandGroupBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    Collection,
    DiscordAPIError,
    MessageFlags,
    REST,
} from "discord.js";
import {
    CommandRegistry,
    HyperionClient,
    InteractionDispatcher,
    Subcommand,
    SubcommandGroup,
} from "../src/index.ts";
import { parseCommandPath } from "../src/registries/parse-command-path.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");
const imports = `import { Command, ParentCommand, Subcommand, SubcommandGroup, Guard } from ${JSON.stringify(library)};
import { ChatInputCommandBuilder, ChatInputCommandSubcommandBuilder, ChatInputCommandSubcommandGroupBuilder, UserContextCommandBuilder } from ${JSON.stringify(builders)};`;
const parentSource = (guards = "") => `${imports}
export default class extends ParentCommand {
    constructor() { super({ builder: new ChatInputCommandBuilder().setDescription("Tickets"), ${guards} }); }
}`;
const groupSource = (extra = "", guards = "", tail = "") => `${imports}
export default class extends SubcommandGroup {
    constructor() { super({ builder: new ChatInputCommandSubcommandGroupBuilder().setDescription("Settings")${extra}, ${guards} }); ${tail} }
}`;
const leafSource = (name = "view", guards = "", methods = "") => `${imports}
export default class extends Subcommand {
    constructor() { super({ builder: new ChatInputCommandSubcommandBuilder().setName(${JSON.stringify(name)}).setDescription("Action"), ${guards} }); }
    async run(ctx) { ctx.interaction.events?.push("handler"); await ctx.interaction.reply("done"); }
    ${methods}
}`;
const manualChild =
    '.addSubcommands(child => child.setName("manual").setDescription("Manual"))';
const credentials = { applicationId: "123", token: "fake-token" };

const fixture = async (t: TestContext) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-groups-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const add = async (file: string, source: string) => {
        const filename = path.join(root, "src", "commands", file);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, source);
        return filename;
    };
    const parentFile = await add("(public)/[ticket]/index.mjs", parentSource());
    const groupFile = await add(
        "(public)/[ticket]/{settings}/index.mjs",
        groupSource(),
    );
    const leafFile = await add(
        "(public)/[ticket]/{settings}/view.mjs",
        leafSource(),
    );
    return { root, add, parentFile, groupFile, leafFile };
};

class Group extends SubcommandGroup {
    constructor(
        builder = new ChatInputCommandSubcommandGroupBuilder().setDescription(
            "Settings",
        ),
    ) {
        super({ builder });
    }
}

test("group definitions retain a native builder without an executable handler", () => {
    const builder = new ChatInputCommandSubcommandGroupBuilder().setDescription(
        "Settings",
    );
    const group = new Group(builder);
    assert.equal(group.builder, builder);
    assert.equal("run" in group, false);
    assert.deepEqual(group.guards, []);
    assert.ok(Object.isFrozen(group.guards));
    assert.throws(
        () =>
            new Group(
                new ChatInputCommandSubcommandGroupBuilder()
                    .setDescription("Settings")
                    .addSubcommands(child =>
                        child.setName("manual").setDescription("Manual"),
                    ),
            ),
    );
    for (const wrong of [
        new ChatInputCommandBuilder(),
        new ChatInputCommandSubcommandBuilder(),
        new UserContextCommandBuilder(),
        { options: [], toJSON: () => ({ description: "Settings" }) },
    ]) {
        assert.throws(
            () =>
                new Group(
                    wrong as unknown as ChatInputCommandSubcommandGroupBuilder,
                ),
            TypeError,
        );
    }
});

test("compose preserves native metadata and localizations in a fresh builder each time", () => {
    const builder = new ChatInputCommandSubcommandGroupBuilder()
        .setDescription("Manage settings")
        .setNameLocalizations({ "en-US": "settings", fr: "parametres" })
        .setDescriptionLocalizations({
            "en-US": "Manage settings",
            fr: "Gerer les parametres",
        });
    const group = new Group(builder);
    class Leaf extends Subcommand {
        constructor(name: string) {
            super({
                builder: new ChatInputCommandSubcommandBuilder()
                    .setName(name)
                    .setDescription("Action"),
            });
        }
        async run() {}
    }
    const view = new Leaf("view");
    const update = new Leaf("update");
    const children = Object.freeze([view, update]);
    const first = group.compose("settings", children);
    const second = group.compose("settings", children);
    assert.ok(first instanceof ChatInputCommandSubcommandGroupBuilder);
    assert.notEqual(first, builder);
    assert.notEqual(first, second);
    assert.deepEqual(first.toJSON(), {
        ...builder.toJSON(false),
        name: "settings",
        options: children.map(child => child.builder.toJSON()),
    });
    assert.deepEqual(second.toJSON(), first.toJSON());
    assert.deepEqual(group.compose("settings", [update]).toJSON().options, [
        update.builder.toJSON(),
    ]);
    assert.deepEqual(
        first.toJSON().options,
        children.map(child => child.builder.toJSON()),
    );
    assert.deepEqual(builder.options, []);
    assert.equal(builder.toJSON(false).name, undefined);
    assert.throws(() => group.compose("settings", []));
    builder.setName("other");
    assert.throws(() => group.compose("settings", children));
    assert.deepEqual(builder.options, []);
});

for (const setter of ["setNameLocalizations", "setDescriptionLocalizations"]) {
    for (const localizations of [
        { "en-US": 123 },
        { "not-a-locale": "settings" },
    ]) {
        test(`native validation rejects malformed ${setter}: ${JSON.stringify(localizations)}`, async t => {
            const { root, add } = await fixture(t);
            const source = await add(
                "[ticket]/{invalid}/index.mjs",
                groupSource(`.${setter}(${JSON.stringify(localizations)})`),
            );
            await add("[ticket]/{invalid}/view.mjs", leafSource());
            const registry = new CommandRegistry();
            await registry.load(root);
            const put = t.mock.method(REST.prototype, "put", async () => []);

            await assert.rejects(registry.register(credentials), error => {
                assert.ok(error instanceof Error);
                assert.ok(error.cause instanceof Error);
                assert.ok(error.message.includes(source));
                return true;
            });
            assert.equal(put.mock.callCount(), 0);
        });
    }
}

test("only a direct group index is a group definition", () => {
    assert.deepEqual(
        parseCommandPath("(public)/[ticket]/{settings}/index.mjs"),
        {
            categories: ["public"],
            moduleName: "index",
            parent: "ticket",
            group: "settings",
            groupDefinition: true,
        },
    );
    assert.throws(() =>
        parseCommandPath("[ticket]/{settings}/(helpers)/index.mjs"),
    );
});

test("categories merge logical groups while direct and grouped leaves retain separate identities", async t => {
    const { root, add } = await fixture(t);
    await add("(staff)/[ticket]/{settings}/update.mjs", leafSource("update"));
    await add("[ticket]/{archive}/index.mjs", groupSource());
    await add("[ticket]/{archive}/view.mjs", leafSource());
    await add("[ticket]/view.mjs", leafSource());
    await add("[other]/index.mjs", parentSource());
    await add("[other]/{settings}/index.mjs", groupSource());
    await add("[other]/{settings}/view.mjs", leafSource());
    await add(
        "[ticket]/{settings}/(helpers)/index.mjs",
        'throw new Error("Ignored barrel");',
    );
    const registry = new CommandRegistry();
    await registry.load(root);

    assert.ok(registry.groups instanceof Collection);
    assert.equal(registry.groups.size, 3);
    assert.equal(
        CommandRegistry.groupKey("ticket", "settings"),
        "ticket settings",
    );
    assert.equal(
        CommandRegistry.subcommandKey("ticket", "view"),
        "ticket view",
    );
    assert.equal(
        CommandRegistry.subcommandKey("ticket", "view", "settings"),
        "ticket settings view",
    );
    const group = registry.resolveGroup("ticket", "settings");
    assert.ok(group instanceof SubcommandGroup);
    assert.equal(
        registry.groups.get(CommandRegistry.groupKey("ticket", "settings")),
        group,
    );
    assert.notEqual(registry.resolveGroup("other", "settings"), group);
    assert.equal(registry.resolveGroup("ticket", "missing"), undefined);
    assert.equal(registry.resolve("ticket"), undefined);
    assert.equal(registry.size, 5);
    const grouped = registry.resolveSubcommand("ticket", "view", "settings");
    assert.ok(grouped);
    assert.equal(registry.get("ticket settings view"), grouped);
    assert.equal(
        registry.resolve(
            "ticket",
            ApplicationCommandType.ChatInput,
            "view",
            "settings",
        ),
        grouped,
    );
    assert.notEqual(grouped, registry.resolveSubcommand("ticket", "view"));
    assert.notEqual(
        grouped,
        registry.resolveSubcommand("ticket", "view", "archive"),
    );
    assert.ok(registry.resolveSubcommand("ticket", "update", "settings"));
    assert.equal(
        registry.resolveSubcommand("ticket", "view", "missing"),
        undefined,
    );
});

for (const scenario of [
    "missing",
    "empty",
    "duplicate",
    "name",
    "manual",
    "after-super",
    "duplicate-leaf",
    "collision",
    "nested",
    "context-menu",
    "misplaced-definition",
    "missing-parent",
] as const) {
    test(`invalid ${scenario} group preserves parent, group, and executable collections`, async t => {
        const { root, add } = await fixture(t);
        const registry = new CommandRegistry();
        await registry.load(root);
        const parents = registry.parents;
        const groups = registry.groups;
        const parent = registry.parents.get("ticket");
        const group = registry.resolveGroup("ticket", "settings");
        const leaf = registry.resolveSubcommand("ticket", "view", "settings");
        switch (scenario) {
            case "missing":
                await add("[ticket]/{missing}/view.mjs", leafSource());
                break;
            case "empty":
                await add("[ticket]/{empty}/index.mjs", groupSource());
                break;
            case "duplicate":
                await add(
                    "(staff)/[ticket]/{settings}/index.mjs",
                    groupSource(),
                );
                break;
            case "name":
                await add(
                    "[ticket]/{wrong}/index.mjs",
                    groupSource('.setName("different")'),
                );
                await add("[ticket]/{wrong}/view.mjs", leafSource());
                break;
            case "manual":
                await add(
                    "[ticket]/{manual}/index.mjs",
                    groupSource(manualChild),
                );
                break;
            case "after-super":
                await add(
                    "[ticket]/{manual}/index.mjs",
                    groupSource("", "", `this.builder${manualChild};`),
                );
                await add("[ticket]/{manual}/view.mjs", leafSource());
                break;
            case "duplicate-leaf":
                await add(
                    "(staff)/[ticket]/{settings}/duplicate.mjs",
                    leafSource(),
                );
                break;
            case "collision":
                await add("[ticket]/settings.mjs", leafSource("settings"));
                break;
            case "nested":
                await add(
                    "[ticket]/{settings}/{nested}/view.mjs",
                    leafSource(),
                );
                break;
            case "context-menu":
                await add(
                    "[ticket]/{settings}/inspect.mjs",
                    `${imports} export default class extends Command { constructor() { super({ builder: new UserContextCommandBuilder().setName("Inspect") }); } async run() {} }`,
                );
                break;
            case "misplaced-definition":
                await add("[ticket]/{settings}/group.mjs", groupSource());
                break;
            case "missing-parent":
                await add("[orphan]/{settings}/index.mjs", groupSource());
                await add("[orphan]/{settings}/view.mjs", leafSource());
                break;
        }
        await assert.rejects(registry.load(root), error => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /\.mjs/);
            return true;
        });
        assert.equal(registry.parents, parents);
        assert.equal(registry.groups, groups);
        assert.equal(registry.parents.get("ticket"), parent);
        assert.equal(registry.resolveGroup("ticket", "settings"), group);
        assert.equal(
            registry.resolveSubcommand("ticket", "view", "settings"),
            leaf,
        );
        assert.equal(registry.parents.size, 1);
        assert.equal(registry.groups.size, 1);
        assert.equal(registry.size, 1);
    });
}

test("successful reload replaces parents, groups, and leaves together", async t => {
    const first = await fixture(t);
    const second = await fixture(t);
    await second.add("[ticket]/{archive}/index.mjs", groupSource());
    await second.add("[ticket]/{archive}/view.mjs", leafSource());
    const registry = new CommandRegistry();
    await registry.load(second.root);
    const parent = registry.parents.get("ticket");
    const group = registry.resolveGroup("ticket", "settings");
    const leaf = registry.resolveSubcommand("ticket", "view", "settings");
    await registry.load(first.root);
    assert.notEqual(registry.parents.get("ticket"), parent);
    assert.notEqual(registry.resolveGroup("ticket", "settings"), group);
    assert.notEqual(
        registry.resolveSubcommand("ticket", "view", "settings"),
        leaf,
    );
    assert.equal(registry.resolveGroup("ticket", "archive"), undefined);
    assert.equal(
        registry.resolveSubcommand("ticket", "view", "archive"),
        undefined,
    );
});

test("registration composes fresh native groups with metadata and never accumulates children", async t => {
    const { root, add } = await fixture(t);
    await add("[ticket]/close.mjs", leafSource("close"));
    await add(
        "[ticket]/{localized}/index.mjs",
        groupSource(
            '.setNameLocalizations({ "en-US": "localized" }).setDescriptionLocalizations({ "en-US": "Settings" })',
        ),
    );
    await add(
        "[ticket]/{localized}/search.mjs",
        leafSource("search").replace(
            '.setDescription("Action")',
            '.setDescription("Action").addStringOptions(option => option.setName("query").setDescription("Query").setAutocomplete(true))',
        ),
    );
    const registry = new CommandRegistry();
    await registry.load(root);
    const group = registry.resolveGroup("ticket", "localized");
    assert.ok(group);
    const attach = t.mock.method(group.builder, "addSubcommands");
    const bodies: unknown[] = [];
    t.mock.method(
        REST.prototype,
        "put",
        async (_route: unknown, options: { body: unknown }) => {
            bodies.push(options.body);
            return [];
        },
    );
    await registry.register(credentials);
    await registry.register(credentials);
    assert.deepEqual(bodies[0], bodies[1]);
    const body = bodies[0] as {
        name: string;
        options: {
            name: string;
            type: number;
            name_localizations?: unknown;
            description_localizations?: unknown;
            options?: { name: string; autocomplete?: boolean }[];
        }[];
    }[];
    const parent = body[0];
    assert.equal(parent?.name, "ticket");
    assert.equal(parent?.options.length, 3);
    assert.equal(
        parent?.options.find(option => option.name === "close")?.type,
        ApplicationCommandOptionType.Subcommand,
    );
    const payload = parent?.options.find(option => option.name === "localized");
    assert.equal(payload?.type, ApplicationCommandOptionType.SubcommandGroup);
    assert.deepEqual(payload?.name_localizations, { "en-US": "localized" });
    assert.deepEqual(payload?.description_localizations, {
        "en-US": "Settings",
    });
    assert.equal(payload?.options?.[0]?.name, "search");
    assert.equal(
        (payload?.options?.[0] as { options?: { autocomplete: boolean }[] })
            ?.options?.[0]?.autocomplete,
        true,
    );
    assert.equal(attach.mock.callCount(), 0);
    for (const definition of registry.groups.values())
        assert.equal(definition.builder.options.length, 0);
    assert.equal(registry.parents.get("ticket")?.builder.options.length, 0);
});

for (const scenario of [
    "oversized",
    "invalid-group",
    "invalid-leaf",
    "mutated-group",
    "mutated-parent",
] as const) {
    test(`complete native validation blocks REST for ${scenario} and retains source diagnostics`, async t => {
        const { root, add, parentFile, groupFile, leafFile } = await fixture(t);
        if (scenario === "oversized") {
            for (let index = 0; index < 25; index++)
                await add(
                    `[ticket]/{settings}/child-${index}.mjs`,
                    leafSource(`child-${index}`),
                );
        }
        const registry = new CommandRegistry();
        await registry.load(root);
        const group = registry.resolveGroup("ticket", "settings");
        const parent = registry.parents.get("ticket");
        const leaf = registry.resolveSubcommand("ticket", "view", "settings");
        assert.ok(group && parent && leaf);
        if (scenario === "invalid-group") group.builder.setDescription("");
        if (scenario === "invalid-leaf") leaf.builder.setDescription("");
        if (scenario === "mutated-group")
            group.builder.addSubcommands(child =>
                child.setName("manual").setDescription("Manual"),
            );
        if (scenario === "mutated-parent")
            parent.builder.addSubcommands(child =>
                child.setName("manual").setDescription("Manual"),
            );
        const put = t.mock.method(REST.prototype, "put", async () => []);
        for (let attempt = 0; attempt < 2; attempt++) {
            await assert.rejects(registry.register(credentials), error => {
                assert.ok(error instanceof Error);
                assert.ok(error.cause instanceof Error);
                assert.ok(error.message.includes(parentFile));
                assert.ok(error.message.includes(groupFile));
                assert.ok(error.message.includes(leafFile));
                return true;
            });
        }
        assert.equal(put.mock.callCount(), 0);
        assert.equal(
            group.builder.options.length,
            scenario === "mutated-group" ? 1 : 0,
        );
        assert.equal(
            parent.builder.options.length,
            scenario === "mutated-parent" ? 1 : 0,
        );
        if (scenario === "invalid-group" || scenario === "invalid-leaf") {
            group.builder.setDescription("Settings");
            leaf.builder.setDescription("Action");
            await registry.register(credentials);
            assert.equal(put.mock.callCount(), 1);
        }
    });
}

test("indexed deployment errors preserve the cause and parent, group, and leaf sources", async t => {
    const { root, parentFile, groupFile, leafFile } = await fixture(t);
    const registry = new CommandRegistry();
    await registry.load(root);
    const failure = new DiscordAPIError(
        {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                "0": {
                    options: {
                        _errors: [
                            { code: "INVALID", message: "Invalid option" },
                        ],
                    },
                },
            },
        },
        50035,
        400,
        "PUT",
        "https://discord.com/api/v10/applications/123/commands",
        { body: [] },
    );
    t.mock.method(REST.prototype, "put", async () => {
        throw failure;
    });
    await assert.rejects(registry.register(credentials), error => {
        assert.ok(error instanceof Error);
        assert.equal(error.cause, failure);
        for (const source of [parentFile, groupFile, leafFile])
            assert.ok(error.message.includes(source));
        return true;
    });
});

const guards = (scope: string) => `guards: [1, 2].map(index => ctx => {
    const name = "${scope}" + index;
    ctx.interaction.events.push(name + " factory");
    return new class extends Guard {
        constructor() { super({ description: "Denied" }); }
        run(ctx) { ctx.interaction.events.push(name + " guard"); if (ctx.interaction.failure === name + " error") throw new Error("Guard failed"); return ctx.interaction.failure !== name; }
    };
}),`;

for (const failure of [
    null,
    "parent1",
    "parent2 error",
    "group1",
    "group2 error",
    "leaf1",
    "leaf2 error",
] as const) {
    test(`grouped guards are lazy, ordered, and stop on ${failure ?? "success"}`, async t => {
        const { root, add } = await fixture(t);
        await add("[tools]/index.mjs", parentSource(guards("parent")));
        await add(
            "[tools]/{settings}/index.mjs",
            groupSource("", guards("group")),
        );
        await add(
            "[tools]/{settings}/view.mjs",
            leafSource("view", guards("leaf")),
        );
        const client = await HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            logging: false,
        });
        t.after(() => client.destroy());
        await client.commands.load(root);
        const put = t.mock.method(REST.prototype, "put", async () => []);
        await client.commands.register(credentials);
        assert.equal(put.mock.callCount(), 1);
        const dispatcher = new InteractionDispatcher(client);
        for (let invocation = 0; invocation < 2; invocation++) {
            const events: string[] = [];
            const reply = mock.fn(async (_payload: unknown) => {});
            await dispatcher.dispatch({
                id: "guard-test",
                commandName: "tools",
                commandType: ApplicationCommandType.ChatInput,
                isChatInputCommand: () => true,
                options: {
                    getSubcommand: () => "view",
                    getSubcommandGroup: () => "settings",
                },
                events,
                failure,
                reply,
                user: { id: "user" },
            } as unknown as ChatInputCommandInteraction);
            const expected: string[] = [];
            for (const name of [
                "parent1",
                "parent2",
                "group1",
                "group2",
                "leaf1",
                "leaf2",
            ]) {
                expected.push(`${name} factory`, `${name} guard`);
                if (failure?.startsWith(name)) break;
            }
            if (!failure) expected.push("handler");
            assert.deepEqual(events, expected);
            assert.equal(reply.mock.callCount(), 1);
            if (!failure)
                assert.equal(reply.mock.calls[0]?.arguments[0], "done");
            else
                assert.equal(
                    (
                        reply.mock.calls[0]?.arguments[0] as
                            | { flags: number }
                            | undefined
                    )?.flags,
                    MessageFlags.Ephemeral,
                );
        }
    });
}

test("autocomplete selects the group, skips all guard levels, and never falls back to a direct leaf", async t => {
    const { root, add } = await fixture(t);
    const forbidden =
        'guards: [() => { throw new Error("Guard factory must not run"); }],';
    await add("[tools]/index.mjs", parentSource(forbidden));
    await add(
        "[tools]/view.mjs",
        leafSource(
            "view",
            "",
            'async autocomplete(ctx) { await ctx.interaction.respond([{ name: "direct", value: "direct" }]); }',
        ),
    );
    for (const group of ["settings", "archive", "no-hook"]) {
        await add(`[tools]/{${group}}/index.mjs`, groupSource("", forbidden));
        await add(
            `[tools]/{${group}}/view.mjs`,
            leafSource(
                "view",
                forbidden,
                group === "no-hook"
                    ? ""
                    : `async autocomplete(ctx) { await ctx.interaction.respond([{ name: "${group}", value: "${group}" }]); }`,
            ),
        );
    }
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const dispatcher = new InteractionDispatcher(client);
    for (const group of ["settings", "archive", "missing", "no-hook"]) {
        const respond = mock.fn(async (_payload: unknown) => {});
        let responded = false;
        await dispatcher.dispatch({
            id: "complete",
            commandName: "tools",
            get responded() {
                return responded;
            },
            user: { id: "user" },
            isChatInputCommand: () => false,
            isButton: () => false,
            isStringSelectMenu: () => false,
            isUserSelectMenu: () => false,
            isRoleSelectMenu: () => false,
            isMentionableSelectMenu: () => false,
            isChannelSelectMenu: () => false,
            isModalSubmit: () => false,
            isAutocomplete: () => true,
            options: {
                getSubcommand: () => "view",
                getSubcommandGroup: () => group,
            },
            respond: async (choices: unknown[]) => {
                assert.equal(responded, false);
                await respond(choices);
                responded = true;
            },
        } as unknown as AutocompleteInteraction);
        assert.equal(respond.mock.callCount(), 1);
        assert.deepEqual(
            respond.mock.calls[0]?.arguments[0],
            group === "missing" || group === "no-hook"
                ? []
                : [{ name: group, value: group }],
        );
    }
    const events: string[] = [];
    const reply = mock.fn(async (_payload: unknown) => {});
    await dispatcher.dispatch({
        id: "unknown-group",
        commandName: "tools",
        commandType: ApplicationCommandType.ChatInput,
        isChatInputCommand: () => true,
        options: {
            getSubcommand: () => "view",
            getSubcommandGroup: () => "missing",
        },
        events,
        reply,
        user: { id: "user" },
    } as unknown as ChatInputCommandInteraction);
    assert.deepEqual(events, []);
    assert.equal(reply.mock.callCount(), 1);
    assert.equal(
        (reply.mock.calls[0]?.arguments[0] as { flags: number } | undefined)
            ?.flags,
        MessageFlags.Ephemeral,
    );
});
