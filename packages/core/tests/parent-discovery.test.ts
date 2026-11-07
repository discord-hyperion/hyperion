import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { MessageFlags, REST } from "discord.js";
import {
    createAutocompleteInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";
import {
    CommandRegistry,
    HyperionClient,
    InteractionDispatcher,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");
const imports = `import { defineCommand, defineParentCommand, defineSubcommand, defineGuard } from ${JSON.stringify(library)};
import { ChatInputCommandBuilder, ChatInputCommandSubcommandBuilder } from ${JSON.stringify(builders)};`;

const parentSource = (extra = "", guards = "", tail = "") => `${imports}
const parent = defineParentCommand({ builder: new ChatInputCommandBuilder().setDescription("Manage tickets")${extra}, ...{ ${guards} } });
${tail}
export default parent;`;
const leafSource = (name = "close", guards = "", methods = "") => `${imports}
export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder().setName(${JSON.stringify(name)}).setDescription("Ticket action"),
    ...{ ${guards} },
    async run(ctx) { ctx.interaction.events?.push("handler"); await ctx.interaction.reply("done"); },
    ${methods}
});`;

const fixture = async (t: TestContext) => {
    const root = await createTempRoot(t, "hyperion-parents-");
    const add = async (file: string, source: string) => {
        const filename = path.join(root, "src", "commands", file);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, source);

        return filename;
    };
    await add("(public)/[ticket]/index.mjs", parentSource());
    await add("(public)/[ticket]/close.mjs", leafSource());

    return { root, add };
};

test("one explicit parent is shared across categories and ordinary barrels stay unimported", async t => {
    const { root, add } = await fixture(t);
    await add("(staff)/[ticket]/open.mjs", leafSource("open"));
    await add("index.mjs", 'throw new Error("Root barrel must not run");');

    await add(
        "(staff)/index.mjs",
        'throw new Error("Category barrel must not run");',
    );

    await add(
        "(staff)/[ticket]/(helpers)/index.mjs",
        'throw new Error("Nested barrel must not run");',
    );

    const registry = new CommandRegistry();
    await registry.load(root);

    assert.equal(registry.parents.size, 1);
    assert.equal(
        registry.parents.get("ticket")?.builder.toJSON(false).description,
        "Manage tickets",
    );
    assert.equal(registry.resolve("ticket"), undefined);
    assert.ok(registry.resolveSubcommand("ticket", "open"));
    assert.ok(registry.resolveSubcommand("ticket", "close"));
});

for (const scenario of [
    "missing",
    "empty",
    "duplicate",
    "name",
    "manual",
    "after-super",
    "legacy-leaf",
    "standalone-leaf",
    "misplaced-parent",
] as const) {
    test(`invalid ${scenario} parent configuration preserves both registry collections`, async t => {
        const { root, add } = await fixture(t);
        const registry = new CommandRegistry();
        await registry.load(root);
        const parentCollection = registry.parents;
        const parent = registry.parents.get("ticket");
        const leaf = registry.resolveSubcommand("ticket", "close");

        switch (scenario) {
            case "missing":
                await add("[orphan]/view.mjs", leafSource("view"));
                break;
            case "empty":
                await add("[empty]/index.mjs", parentSource());
                break;
            case "duplicate":
                await add("(staff)/[ticket]/index.mjs", parentSource());
                break;
            case "name":
                await add(
                    "[other]/index.mjs",
                    parentSource('.setName("wrong")'),
                );

                await add("[other]/view.mjs", leafSource("view"));
                break;
            case "manual":
                await add(
                    "[other]/index.mjs",
                    parentSource(
                        '.addSubcommands(sub => sub.setName("manual").setDescription("Manual"))',
                    ),
                );

                break;
            case "after-super":
                await add(
                    "[other]/index.mjs",
                    parentSource(
                        "",
                        "",
                        'parent.builder.addStringOptions(option => option.setName("manual").setDescription("Manual"));',
                    ),
                );

                break;
            case "legacy-leaf":
                await add(
                    "[ticket]/legacy.mjs",
                    `${imports} export default defineCommand({
                        builder: new ChatInputCommandBuilder().setName("legacy").setDescription("Legacy"),
                        async run() {},
                    })`,
                );

                break;
            case "standalone-leaf":
                await add("view.mjs", leafSource("view"));
                break;
            case "misplaced-parent":
                await add("[ticket]/parent.mjs", parentSource());
                break;
        }

        await assert.rejects(registry.load(root), error => {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes(".mjs"));

            return true;
        });

        assert.equal(registry.parents, parentCollection);
        assert.equal(registry.parents.get("ticket"), parent);
        assert.equal(registry.resolveSubcommand("ticket", "close"), leaf);
        assert.equal(registry.size, 1);
        assert.equal(registry.parents.size, 1);
    });
}

const guard = (scope: string) => `guards: [ctx => {
    ctx.interaction.events.push("${scope} factory");
    return defineGuard({ name: "test-guard", description: "${scope} rejected", run(ctx) { ctx.interaction.events.push("${scope} guard"); if (ctx.interaction.failure === "${scope} error") throw new Error("Guard failed"); return ctx.interaction.failure !== "${scope}"; } });
}],`;

for (const failure of [
    null,
    "parent",
    "parent error",
    "leaf",
    "leaf error",
] as const) {
    test(`inherited guard order and stopping behavior: ${failure ?? "success"}`, async t => {
        const { root, add } = await fixture(t);
        // A second logical parent avoids rewriting an already imported fixture module.
        await add("[tools]/index.mjs", parentSource("", guard("parent")));
        await add("[tools]/run.mjs", leafSource("run", guard("leaf")));

        const client = await HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            logging: false,
        });

        t.after(() => client.destroy());
        await client.commands.load(root);
        const events: string[] = [];
        const request = createChatInputInteraction({
            id: "guard-test",
            commandName: "tools",
            options: {
                getSubcommand: () => "run",
                getSubcommandGroup: () => null,
            },
            user: { id: "user" },
        });
        Object.assign(request.interaction, { events, failure });
        const { reply } = request;
        await new InteractionDispatcher(client).dispatch(request.interaction);

        const expected = ["parent factory", "parent guard"];

        if (!failure?.startsWith("parent")) {
            expected.push("leaf factory", "leaf guard");
        }

        if (!failure) {
            expected.push("handler");
        }

        assert.deepEqual(events, expected);
        assert.equal(reply.mock.callCount(), 1);

        if (!failure) {
            assert.equal(reply.mock.calls[0]?.arguments[0], "done");
        } else {
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

test("autocomplete and deployment do not invoke inherited guard factories", async t => {
    const { root, add } = await fixture(t);
    const forbiddenGuard =
        'guards: [() => { throw new Error("Must not invoke guard factories"); }],';
    await add("[tools]/index.mjs", parentSource("", forbiddenGuard));

    await add(
        "[tools]/search.mjs",
        leafSource(
            "search",
            forbiddenGuard,
            'async autocomplete(ctx) { await ctx.interaction.respond([{ name: "Found", value: "found" }]); }',
        ),
    );

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.commands.load(root);
    t.mock.method(REST.prototype, "get", async () => []);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await client.commands.register({
        applicationId: "123",
        token: "fake-token",
    });

    const request = createAutocompleteInteraction({
        id: "complete",
        commandName: "tools",
        user: { id: "user" },
        options: {
            getSubcommand: () => "search",
            getSubcommandGroup: () => null,
        },
    });
    const { respond } = request;
    respond.mock.mockImplementation(async () => {
        if (respond.mock.callCount() > 0) {
            throw new Error("Double response");
        }
    });
    await new InteractionDispatcher(client).dispatch(request.interaction);

    assert.equal(put.mock.callCount(), 1);
    assert.deepEqual(respond.mock.calls[0]?.arguments[0], [
        { name: "Found", value: "found" },
    ]);
});

test("the SDK rejects an oversized composed parent before any REST call", async t => {
    const { root, add } = await fixture(t);
    for (let index = 0; index < 25; index++) {
        await add(
            `(staff)/[ticket]/child-${index}.mjs`,
            leafSource(`child-${index}`),
        );
    }
    const registry = new CommandRegistry();
    await registry.load(root);
    t.mock.method(REST.prototype, "get", async () => []);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await assert.rejects(
        registry.register({ applicationId: "123", token: "fake-token" }),
        error => {
            assert.ok(error instanceof Error);
            assert.ok(error.cause instanceof Error);
            assert.match(error.message, /index.mjs/);

            return true;
        },
    );

    assert.equal(put.mock.callCount(), 0);
    assert.equal(registry.parents.get("ticket")?.builder.options.length, 0);
});
