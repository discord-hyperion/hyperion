import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    DiscordAPIError,
    MessageFlags,
    REST,
} from "discord.js";
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

const entryPoint = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");
const commandSource = (name: string, extra = "", methods = "", guards = "") => `
    import { Command, Subcommand, defineGuard } from ${JSON.stringify(entryPoint)};
    import { ChatInputCommandBuilder, ChatInputCommandSubcommandBuilder, UserContextCommandBuilder } from ${JSON.stringify(builders)};
    export default class extends Subcommand {
        constructor() { super({ builder: new ChatInputCommandSubcommandBuilder().setName(${JSON.stringify(name)}).setDescription("Test subcommand")${extra}, ${guards} }); }
        async run(ctx) { await ctx.interaction.reply(this.builder.toJSON(false).name); }
        ${methods}
    }
`;

const standaloneSource = (name: string) =>
    commandSource(name)
        .replace("extends Subcommand", "extends Command")
        .replace(
            "builder: new ChatInputCommandSubcommandBuilder()",
            "builder: new ChatInputCommandBuilder()",
        );

const parentSource = (extra = "", guards = "") => `
    import { ParentCommand, defineGuard } from ${JSON.stringify(entryPoint)};
    import { ChatInputCommandBuilder } from ${JSON.stringify(builders)};
    export default class extends ParentCommand {
        constructor() { super({ builder: new ChatInputCommandBuilder().setDescription("Manage test commands.")${extra}, ${guards} }); }
    }
`;

const fixture = async (t: TestContext) => {
    const root = await createTempRoot(t, "hyperion-subcommands-");
    const definedParents = new Set<string>();
    const add = async (relativePath: string, source: string) => {
        const segments = relativePath.split("/");
        const parentIndex = segments.findIndex(segment =>
            /^\[.+\]$/.test(segment),
        );
        const parent = segments[parentIndex];

        if (parent) {
            if (
                !definedParents.has(parent) &&
                !/^index\./.test(path.basename(relativePath))
            ) {
                const directory = path.join(
                    root,
                    "src",
                    "commands",
                    ...segments.slice(0, parentIndex + 1),
                );
                await mkdir(directory, { recursive: true });
                await writeFile(
                    path.join(directory, "index.mjs"),
                    parentSource(),
                );
            }
            definedParents.add(parent);
        }

        const filename = path.join(root, "src", "commands", relativePath);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, source);
        return filename;
    };
    return { root, add };
};

const interaction = (
    subcommand: string | null,
    group: string | null = null,
    autocomplete = false,
) => {
    const data = {
        id: "subcommand-interaction",
        commandName: "tools",
        user: { id: "allowed" },
        guildId: "guild",
        options: {
            getSubcommand: () => subcommand,
            getSubcommandGroup: () => group,
        },
    };
    return autocomplete
        ? createAutocompleteInteraction(data)
        : createChatInputInteraction(data);
};

test("subcommands use folder parents and builder leaf names, preserving ordinary lookups", async t => {
    const { root, add } = await fixture(t);
    await add(
        "(category)/[tools]/different-filename.mjs",
        commandSource("ping"),
    );
    await add("[other]/ping.mjs", commandSource("ping"));
    await add("ping.mjs", standaloneSource("ping"));
    const registry = new CommandRegistry();
    await registry.load(root);

    assert.deepEqual([...registry.keys()].sort(), [
        "other ping",
        "ping",
        "tools ping",
    ]);
    assert.equal(
        registry.resolveSubcommand("tools", "ping")?.builder.toJSON().name,
        "ping",
    );
    assert.equal(
        registry.resolve("tools", ApplicationCommandType.ChatInput, "ping"),
        registry.resolveSubcommand("tools", "ping"),
    );
    assert.ok(registry.resolve("ping"));
    assert.equal(registry.resolve("tools"), undefined);
    assert.equal(registry.resolveSubcommand("tools", "missing"), undefined);
});

test("registration composes sibling subcommands into one parent and preserves options", async t => {
    const { root, add } = await fixture(t);
    await add(
        "[tools]/echo.mjs",
        commandSource(
            "echo",
            '.addStringOptions(option => option.setName("query").setDescription("Search").setRequired(true).setAutocomplete(true))',
        ),
    );
    await add("[tools]/ping.mjs", commandSource("ping"));
    await add("standalone.mjs", standaloneSource("standalone"));
    const registry = new CommandRegistry();
    await registry.load(root);
    const put = t.mock.method(
        REST.prototype,
        "put",
        async (_route: unknown, _options: { body?: unknown }) => [],
    );

    await registry.register({
        applicationId: "123",
        token: "fake-token",
        guildIds: ["456"],
    });
    const body = put.mock.calls[0]?.arguments[1]?.body as {
        name: string;
        description?: string;
        options?: {
            type: number;
            name: string;
            options?: {
                name: string;
                required?: boolean;
                autocomplete?: boolean;
            }[];
        }[];
    }[];
    const parent = body.find(command => command.name === "tools");

    assert.equal(body.length, 2);
    assert.equal(parent?.description, "Manage test commands.");
    assert.deepEqual(
        parent?.options?.map(option => [option.type, option.name]),
        [
            [ApplicationCommandOptionType.Subcommand, "echo"],
            [ApplicationCommandOptionType.Subcommand, "ping"],
        ],
    );
    assert.deepEqual(parent?.options?.[0]?.options?.[0], {
        type: ApplicationCommandOptionType.String,
        name: "query",
        description: "Search",
        required: true,
        autocomplete: true,
    });
    assert.equal(
        registry.resolveSubcommand("tools", "echo")?.builder.toJSON().type,
        ApplicationCommandType.ChatInput,
    );
});

for (const scenario of [
    "duplicate",
    "standalone",
    "group",
    "context-menu",
    "metadata",
    "nested",
] as const) {
    test(`invalid ${scenario} configuration preserves the loaded registry`, async t => {
        const { root, add } = await fixture(t);
        await add("[tools]/ping.mjs", commandSource("ping"));
        const registry = new CommandRegistry();
        await registry.load(root);
        const original = registry.resolveSubcommand("tools", "ping");

        switch (scenario) {
            case "duplicate":
                await add(
                    "(other)/[tools]/duplicate.mjs",
                    commandSource("ping"),
                );
                break;
            case "standalone":
                await add("tools.mjs", standaloneSource("tools"));
                break;
            case "group":
                await add("[tools]/{settings}/view.mjs", commandSource("view"));
                break;
            case "context-menu":
                await add(
                    "[tools]/context.mjs",
                    commandSource("context").replace(
                        'new ChatInputCommandSubcommandBuilder().setName("context").setDescription("Test subcommand")',
                        'new UserContextCommandBuilder().setName("Inspect")',
                    ),
                );
                break;
            case "metadata":
                await add(
                    "[tools]/restricted.mjs",
                    commandSource("restricted", ".setNSFW(true)"),
                );
                break;
            case "nested":
                await add(
                    "[tools]/nested.mjs",
                    commandSource(
                        "nested",
                        '.addSubcommands(sub => sub.setName("child").setDescription("Nested"))',
                    ),
                );
                break;
        }

        await assert.rejects(registry.load(root));
        assert.equal(registry.resolveSubcommand("tools", "ping"), original);
        assert.equal(registry.size, 1);
    });
}

test("dispatch selects only the requested leaf and runs its guards", async t => {
    const { root, add } = await fixture(t);
    await add(
        "[tools]/ping.mjs",
        commandSource(
            "ping",
            "",
            "",
            `guards: [ctx => defineGuard({ name: "test-guard", description: "Not allowed", run() { return ctx.interaction.user.id === "allowed"; } })],`,
        ),
    );
    await add("[tools]/other.mjs", commandSource("other"));
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const dispatcher = new InteractionDispatcher(client);
    const allowed = interaction("ping");
    await dispatcher.dispatch(allowed.interaction);
    assert.equal(allowed.reply.mock.calls[0]?.arguments[0], "ping");

    const rejected = interaction("ping");
    Object.assign(rejected.interaction, { user: { id: "denied" } });
    await dispatcher.dispatch(rejected.interaction);
    assert.deepEqual(rejected.reply.mock.calls[0]?.arguments[0], {
        content: "Not allowed",
        flags: MessageFlags.Ephemeral,
    });

    for (const item of [
        interaction("missing"),
        interaction(null),
        interaction("ping", "group"),
    ]) {
        await dispatcher.dispatch(item.interaction);
        assert.deepEqual(item.reply.mock.calls[0]?.arguments[0], {
            content:
                "This command is no longer available. Please try again later.",
            flags: MessageFlags.Ephemeral,
        });
    }
});

test("autocomplete resolves the leaf, skips guards, and falls back to empty choices", async t => {
    const { root, add } = await fixture(t);
    await add(
        "[tools]/search.mjs",
        commandSource(
            "search",
            "",
            'async autocomplete(ctx) { await ctx.interaction.respond([{ name: "Result", value: "result" }]); }',
            'guards: [() => { throw new Error("Guards must not run"); }],',
        ),
    );
    await add("[tools]/ping.mjs", commandSource("ping"));
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const dispatcher = new InteractionDispatcher(client);
    const search = interaction("search", null, true);
    await dispatcher.dispatch(search.interaction);
    assert.equal(search.respond.mock.callCount(), 1);
    assert.deepEqual(search.respond.mock.calls[0]?.arguments[0], [
        { name: "Result", value: "result" },
    ]);

    for (const name of ["ping", "missing"]) {
        const item = interaction(name, null, true);
        await dispatcher.dispatch(item.interaction);
        assert.deepEqual(item.respond.mock.calls[0]?.arguments[0], []);
        assert.equal(item.reply.mock.callCount(), 0);
    }
});

test("subcommand serialization failures retain the leaf source and make no REST request", async t => {
    const { root, add } = await fixture(t);
    const source = await add(
        "[tools]/broken.mjs",
        commandSource(
            "broken",
            '.addStringOptions(option => option.setName("query"))',
        ),
    );
    const registry = new CommandRegistry();
    await registry.load(root);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await assert.rejects(
        registry.register({ applicationId: "123", token: "fake-token" }),
        error => {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes(source));
            assert.ok(error.cause instanceof Error);
            return true;
        },
    );
    assert.equal(put.mock.callCount(), 0);
});

test("context menus can share a filesystem parent's name", async t => {
    const { root, add } = await fixture(t);
    await add("[tools]/ping.mjs", commandSource("ping"));
    await add(
        "context.mjs",
        standaloneSource("tools").replace(
            'new ChatInputCommandBuilder().setName("tools").setDescription("Test subcommand")',
            'new UserContextCommandBuilder().setName("tools")',
        ),
    );
    const registry = new CommandRegistry();
    await registry.load(root);

    assert.ok(registry.resolve("tools", ApplicationCommandType.User));
    assert.ok(registry.resolveSubcommand("tools", "ping"));
});

test("indexed Discord errors retain all contributing subcommand sources", async t => {
    const { root, add } = await fixture(t);
    const first = await add("[tools]/first.mjs", commandSource("first"));
    const second = await add("[tools]/second.mjs", commandSource("second"));
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
                            { code: "INVALID", message: "Invalid subcommands" },
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

    await assert.rejects(
        registry.register({ applicationId: "123", token: "fake-token" }),
        error => {
            assert.ok(error instanceof Error);
            assert.equal(error.cause, failure);
            assert.ok(error.message.includes('body[0]: "tools"'));
            assert.ok(error.message.includes(first));
            assert.ok(error.message.includes(second));
            return true;
        },
    );
});
