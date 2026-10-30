import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, type TestContext, test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    Events,
} from "discord.js";
import { createAutocompleteInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    type AutocompleteContext,
    Command,
    type CommandContext,
    CommandRegistry,
    type GuardProvider,
    HyperionClient,
    InteractionDispatcher,
} from "../src/index.ts";

class TestCommand extends Command {
    readonly executeCommand = mock.fn(async (_ctx: CommandContext) => {});

    constructor(
        private readonly complete: (ctx: AutocompleteContext) => Promise<void>,
        guards: readonly GuardProvider[] = [],
    ) {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("search")
                .setDescription("Test autocomplete")
                .addStringOptions(option =>
                    option
                        .setName("query")
                        .setDescription("Search")
                        .setAutocomplete(true),
                ),
            guards,
        });
    }

    autocomplete(ctx: AutocompleteContext) {
        return this.complete(ctx);
    }

    run(ctx: CommandContext) {
        return this.executeCommand(ctx);
    }
}

const interaction = (
    input = "private-query",
    name = "query",
    type: AutocompleteFocusedOption["type"] = ApplicationCommandOptionType.String,
) => {
    const getFocused = mock.fn(() => ({
        name,
        value: input,
        type,
        focused: true as const,
    }));
    return {
        ...createAutocompleteInteraction({
            id: "autocomplete-request",
            commandName: "search",
            guildId: "guild",
            user: { id: "caller" },
            options: { getFocused },
        }),
        getFocused,
    };
};

const setup = async (t: TestContext, level: "debug" | "info" = "debug") => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level,
            pretty: false,
            progress: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });
    t.after(() => client.destroy());

    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

test("autocomplete listener preserves the receiver, skips command execution and guards, and scopes logs", async t => {
    const { client, records } = await setup(t);
    const guard = mock.fn(() => {
        throw new Error("Not during autocomplete");
    });
    class Inspect extends TestCommand {
        async autocomplete(ctx: AutocompleteContext) {
            assert.equal(this.builder.toJSON().name, "search");
            assert.equal(ctx.client, client);
            assert.equal(
                ctx.interaction.options.getFocused().value,
                "private-query",
            );
            await ctx.interaction.respond([
                { name: "Private suggestion", value: "private-value" },
            ]);
        }
    }
    const command = new Inspect(async () => {}, [guard]);
    client.commands.set("search", command);
    const fixture = interaction();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.respond.mock.callCount(), 1);
    assert.equal(command.executeCommand.mock.callCount(), 0);
    assert.equal(guard.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.deepEqual(fixture.getFocused.mock.calls[0]?.arguments, []);
    const completed = records.find(
        record => record.event === "autocomplete.completed",
    );
    assert.equal(completed?.command, "search");
    assert.equal(completed?.interactionId, "autocomplete-request");
    assert.equal(completed?.guildId, "guild");
    assert.equal(completed?.userId, "caller");
    assert.equal(typeof completed?.durationMs, "number");
    for (const privateValue of [
        "private-query",
        "Private suggestion",
        "private-value",
    ]) {
        assert.ok(!JSON.stringify(records).includes(privateValue));
    }
});

for (const missing of ["command", "hook", "response"]) {
    test(`missing autocomplete ${missing} receives empty choices`, async t => {
        const { client, dispatcher } = await setup(t);
        if (missing === "hook") {
            class NoAutocomplete extends Command {
                constructor() {
                    super({
                        builder: new ChatInputCommandBuilder()
                            .setName("search")
                            .setDescription("No hook"),
                    });
                }
                async run() {
                    throw new Error("Not command execution");
                }
            }
            const command = new NoAutocomplete();
            assert.equal(command.autocomplete, undefined);
            client.commands.set("search", command);
        } else if (missing === "response") {
            client.commands.set("search", new TestCommand(async () => {}));
        }
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(fixture.respond.mock.callCount(), 1);
        assert.deepEqual(fixture.respond.mock.calls[0]?.arguments[0], []);
        assert.equal(fixture.reply.mock.callCount(), 0);
    });
}

for (const asynchronous of [false, true]) {
    test(`${asynchronous ? "async" : "sync"} autocomplete failures are logged and return empty choices`, async t => {
        const { client, dispatcher, records } = await setup(t);
        const failure = new Error("Lookup failed");
        const fail = () => {
            throw failure;
        };
        client.commands.set(
            "search",
            new TestCommand(asynchronous ? async () => fail() : fail),
        );
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(fixture.respond.mock.calls[0]?.arguments[0], []);
        assert.equal(fixture.respond.mock.callCount(), 1);
        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.equal(
            records.find(record => record.event === "autocomplete.failed")
                ?.command,
            "search",
        );
        assert.ok(!records.some(record => record.event === "command.failed"));
    });
}

test("already-responded autocomplete requests do not run handlers or respond twice", async t => {
    const { client, dispatcher } = await setup(t);
    const complete = mock.fn(async (_ctx: AutocompleteContext) => {});
    client.commands.set("search", new TestCommand(complete));
    const fixture = interaction();
    Object.assign(fixture.interaction, { responded: true });
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(complete.mock.callCount(), 0);
    assert.equal(fixture.respond.mock.callCount(), 0);
});

test("a failure after responding does not attempt another autocomplete response", async t => {
    const { client, dispatcher, records } = await setup(t);
    client.commands.set(
        "search",
        new TestCommand(async ctx => {
            await ctx.interaction.respond([{ name: "Found", value: "found" }]);
            throw new Error("Post-response failure");
        }),
    );
    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.respond.mock.callCount(), 1);
    assert.ok(records.some(record => record.event === "autocomplete.failed"));
});

for (const hasHandler of [false, true]) {
    test(`expired autocomplete fallback is contained ${hasHandler ? "after a handler failure" : "without a handler"}`, async t => {
        const { client, records } = await setup(t);
        if (hasHandler) {
            client.commands.set(
                "search",
                new TestCommand(async () => {
                    throw new Error("Lookup failed");
                }),
            );
        }
        const fixture = interaction();
        fixture.respond.mock.mockImplementation(async () => {
            throw new Error("Expired interaction");
        });
        client.emit(Events.InteractionCreate, fixture.interaction);
        await client.waitForAllListenersToComplete();

        assert.equal(fixture.respond.mock.callCount(), 1);
        assert.ok(
            records.some(
                record => record.event === "autocomplete.response.failed",
            ),
        );
        assert.equal(fixture.followUp.mock.callCount(), 0);
    });
}

test("a rejected suggestion response falls back to empty choices", async t => {
    const { client, dispatcher } = await setup(t);
    client.commands.set(
        "search",
        new TestCommand(async ctx => {
            await ctx.interaction.respond([
                { name: "Rejected", value: "rejected" },
            ]);
        }),
    );
    const fixture = interaction();
    fixture.respond.mock.mockImplementation(async choices => {
        if (choices.length) throw new Error("Response rejected");
    });
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.respond.mock.callCount(), 2);
    assert.deepEqual(fixture.respond.mock.calls[1]?.arguments[0], []);
});

for (const type of [
    ApplicationCommandOptionType.Integer,
    ApplicationCommandOptionType.Number,
] as const) {
    test(`numeric autocomplete preserves number choice values for option type ${type}`, async t => {
        const { client, dispatcher } = await setup(t);
        client.commands.set(
            "search",
            new TestCommand(async ctx => {
                const focused = ctx.interaction.options.getFocused();
                assert.equal(focused.name, "amount");
                assert.equal(focused.type, type);
                await ctx.interaction.respond([
                    {
                        name: "One",
                        value:
                            type === ApplicationCommandOptionType.Integer
                                ? 1
                                : 1.5,
                    },
                ]);
            }),
        );
        const fixture = interaction("1", "amount", type);
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(
            typeof fixture.respond.mock.calls[0]?.arguments[0]?.[0]?.value,
            "number",
        );
        assert.equal(fixture.respond.mock.callCount(), 1);
    });
}

test("autocomplete retains subcommand options and creates separate concurrent contexts", async t => {
    const { client, dispatcher } = await setup(t);
    const contexts: AutocompleteContext[] = [];
    client.commands.set(
        "search",
        new TestCommand(async ctx => {
            contexts.push(ctx);
            assert.equal(ctx.interaction.options.getSubcommand(), "items");
            assert.equal(
                ctx.interaction.options.getSubcommandGroup(),
                "catalog",
            );
            const query = await Promise.resolve(
                ctx.interaction.options.getFocused().value,
            );
            await ctx.interaction.respond([{ name: query, value: query }]);
        }),
    );
    const first = interaction("first");
    const second = interaction("second");
    for (const fixture of [first, second]) {
        Object.assign(fixture.interaction.options, {
            getSubcommand: () => "items",
            getSubcommandGroup: () => "catalog",
        });
    }
    await Promise.all([
        dispatcher.dispatch(first.interaction),
        dispatcher.dispatch(second.interaction),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.deepEqual(first.respond.mock.calls[0]?.arguments[0], [
        { name: "first", value: "first" },
    ]);
    assert.deepEqual(second.respond.mock.calls[0]?.arguments[0], [
        { name: "second", value: "second" },
    ]);
});

test("autocomplete success is quiet at info level while failures remain visible", async t => {
    const { client, dispatcher, records } = await setup(t, "info");
    client.commands.set(
        "search",
        new TestCommand(async ctx => {
            await ctx.interaction.respond([]);
        }),
    );
    await dispatcher.dispatch(interaction().interaction);
    assert.ok(
        !records.some(record =>
            String(record.event).startsWith("autocomplete."),
        ),
    );

    client.commands.set(
        "search",
        new TestCommand(async () => {
            throw new Error("Unavailable");
        }),
    );
    await dispatcher.dispatch(interaction().interaction);
    assert.ok(records.some(record => record.event === "autocomplete.failed"));
});

test("malformed optional autocomplete hooks retain source context and the previous command registry", async t => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-autocomplete-invalid-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src", "commands"), { recursive: true });
    const commandModule = new URL("../src/commands/command.ts", import.meta.url)
        .href;
    const buildersModule = import.meta.resolve("@discordjs/builders");
    await writeFile(
        path.join(root, "src", "commands", "broken.mjs"),
        `
        import { Command } from ${JSON.stringify(commandModule)};
        import { ChatInputCommandBuilder } from ${JSON.stringify(buildersModule)};
        export default class extends Command {
            constructor() { super({ builder: new ChatInputCommandBuilder().setName("broken").setDescription("Broken") }); }
            autocomplete = 42;
            async run() {}
        }
    `,
    );
    const registry = new CommandRegistry();
    const original = new TestCommand(async () => {});
    registry.set("search", original);
    await assert.rejects(registry.load(root), /broken.mjs.*autocomplete\(\)/);
    assert.equal(registry.get("search"), original);
    assert.equal(registry.size, 1);
});
