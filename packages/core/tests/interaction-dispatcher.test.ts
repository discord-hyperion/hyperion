import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Events, InteractionType, MessageFlags } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import { HyperionClient } from "../src/client/index.ts";
import { Command, type CommandContext } from "../src/commands/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";

class TestCommand extends Command {
    constructor(
        private readonly execute: (ctx: CommandContext) => Promise<void>,
    ) {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("A test command"),
        });
    }

    run(ctx: CommandContext) {
        return this.execute(ctx);
    }
}

const createInteraction = (
    state: { deferred?: boolean; replied?: boolean } = {},
) =>
    createChatInputInteraction({
        id: "test-interaction",
        user: { id: "test-owner" },
        commandName: "ping",
        ...state,
    });

test("passes a fresh context and preserves the command receiver", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    const contexts: CommandContext[] = [];
    const handler = new TestCommand(async ctx => {
        contexts.push(ctx);
    });
    client.commands.set("ping", handler);
    const dispatcher = new InteractionDispatcher(client);
    const first = createInteraction();
    const second = createInteraction();
    await dispatcher.dispatch(first.interaction);
    await dispatcher.dispatch(second.interaction);

    assert.equal(contexts[0]?.client, client);
    assert.equal(contexts[0]?.interaction, first.interaction);
    assert.equal(contexts[1]?.interaction, second.interaction);
    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.reply.mock.callCount(), 0);
    assert.equal(first.deferReply.mock.callCount(), 0);
});

test("ignores interactions other than slash commands and buttons", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    const execute = mock.fn(async () => undefined);
    client.commands.set("ping", new TestCommand(execute));
    const fixture = createInteraction();
    // Deliberately unsupported interaction: leave every dispatch predicate false.
    Object.assign(fixture.interaction, { type: InteractionType.Ping });
    await new InteractionDispatcher(client).dispatch(fixture.interaction);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
});

test("acknowledges a stale command with a private unavailable response", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    const fixture = createInteraction();
    await new InteractionDispatcher(client).dispatch(fixture.interaction);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content: "This command is no longer available. Please try again later.",
        flags: MessageFlags.Ephemeral,
    });
});

for (const phase of ["new", "deferred", "replied"] as const) {
    test(`handles a command failure after the ${phase} acknowledgment state`, async t => {
        const client = await HyperionClient.create({
            root: new URL("./fixtures/empty-bot/", import.meta.url),
            name: "Test",
            logging: false as const,
            discord: { intents: [] },
        });
        t.after(() => client.destroy());
        t.mock.method(client, "getOwnerId", async () => "test-owner");
        const failure = new Error("Internal service details");
        t.mock.method(client.logger, "child", () => client.logger);
        const log = t.mock.method(client.logger, "error", () => undefined);
        client.commands.set(
            "ping",
            new TestCommand(async () => {
                throw failure;
            }),
        );
        const fixture = createInteraction({
            deferred: phase !== "new",
            replied: phase === "replied",
        });

        await new InteractionDispatcher(client).dispatch(fixture.interaction);

        const content = "Something went wrong while running this command.";
        assert.equal(log.mock.callCount(), 1);
        assert.equal(
            (log.mock.calls[0]?.arguments[0] as { err: unknown } | undefined)
                ?.err,
            failure,
        );
        assert.equal(fixture.reply.mock.callCount(), phase === "new" ? 1 : 0);
        assert.equal(
            fixture.editReply.mock.callCount(),
            phase === "deferred" ? 1 : 0,
        );
        assert.equal(
            fixture.followUp.mock.callCount(),
            phase === "replied" ? 1 : 0,
        );
        if (phase === "deferred") {
            assert.deepEqual(fixture.editReply.mock.calls[0]?.arguments[0], {
                content,
            });
        } else {
            const response = phase === "new" ? fixture.reply : fixture.followUp;
            assert.deepEqual(response.mock.calls[0]?.arguments[0], {
                content,
                flags: MessageFlags.Ephemeral,
            });
        }
    });
}

test("falls back to a private follow-up when a deferred reply cannot take content", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client.logger, "child", () => client.logger);
    const errors = t.mock.method(client.logger, "error", () => undefined);
    const debug = t.mock.method(client.logger, "debug", () => undefined);
    client.commands.set(
        "ping",
        new TestCommand(async () => {
            throw new Error("Failed after editing into a layout message");
        }),
    );
    const fixture = createInteraction({ deferred: true });
    // Discord rejects content on a reply already edited into a layout message.
    fixture.editReply.mock.mockImplementation(async () => {
        throw new Error("Cannot send content with IS_COMPONENTS_V2");
    });

    await new InteractionDispatcher(client).dispatch(fixture.interaction);

    const content = "Something went wrong while running this command.";
    assert.equal(fixture.editReply.mock.callCount(), 1);
    assert.deepEqual(fixture.followUp.mock.calls[0]?.arguments[0], {
        content,
        flags: MessageFlags.Ephemeral,
    });
    assert.ok(
        debug.mock.calls.some(
            call =>
                (call.arguments[0] as { event?: string }).event ===
                "command.error-response.fallback",
        ),
    );
    // Only the handler failure is an error; the fallback succeeded.
    assert.equal(errors.mock.callCount(), 1);
});

test("contains synchronous throws and failed error responses in the event listener", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    t.mock.method(client.logger, "child", () => client.logger);
    const log = t.mock.method(client.logger, "error", () => undefined);
    client.commands.set(
        "ping",
        new TestCommand(() => {
            throw new Error("Synchronous failure");
        }),
    );
    const fixture = createInteraction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Interaction expired");
    });

    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(log.mock.callCount(), 2);
    assert.equal(fixture.reply.mock.callCount(), 1);
});

test("does not acknowledge before a handler opens a modal", async t => {
    const client = await HyperionClient.create({
        root: new URL("./fixtures/empty-bot/", import.meta.url),
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    const fixture = createInteraction();
    client.commands.set(
        "ping",
        new TestCommand(async ctx => {
            await ctx.interaction.showModal({
                custom_id: "test",
                title: "Test",
                components: [],
            });
        }),
    );
    await new InteractionDispatcher(client).dispatch(fixture.interaction);
    assert.equal(fixture.showModal.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
});
