import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    type ChatInputCommandInteraction,
    Events,
    MessageFlags,
    REST,
} from "discord.js";
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
    state: { deferred?: boolean; replied?: boolean; chatInput?: boolean } = {},
) => {
    const reply = mock.fn(async (_options: unknown) => undefined);
    const editReply = mock.fn(async (_options: unknown) => undefined);
    const followUp = mock.fn(async (_options: unknown) => undefined);
    const deferReply = mock.fn(async () => undefined);
    const showModal = mock.fn(async () => undefined);
    // Only the interaction surface used by dispatch and these handlers is mocked.
    const interaction = {
        id: "test-interaction",
        user: { id: "test-owner" },
        commandName: "ping",
        deferred: state.deferred ?? false,
        replied: state.replied ?? false,
        isChatInputCommand: () => state.chatInput ?? true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        reply,
        editReply,
        followUp,
        deferReply,
        showModal,
    } as unknown as ChatInputCommandInteraction;

    return { interaction, reply, editReply, followUp, deferReply, showModal };
};

test("filesystem-loaded ping runs through the client's interaction listener", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-ping-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src", "commands"), { recursive: true });
    await writeFile(
        path.join(root, "src", "commands", "ping.mjs"),
        `export { default } from ${JSON.stringify(new URL("../dev/bot/src/commands/ping.ts", import.meta.url).href)};`,
    );
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const client = await HyperionClient.create({
        name: "Test",
        logging: false as const,
        root,
        discord: { intents: [] },
        commands: {
            applicationId: "123",
            token: "test-token",
            guildIds: ["456"],
        },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    assert.equal(put.mock.callCount(), 1);
    assert.equal(client.listenerCount(Events.InteractionCreate), 1);

    const fixture = createInteraction();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Pong!");
    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(client.isReady(), false);
});

test("passes a fresh context and preserves the command receiver", async t => {
    const client = await HyperionClient.create({
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
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    const execute = mock.fn(async () => undefined);
    client.commands.set("ping", new TestCommand(execute));
    const fixture = createInteraction({ chatInput: false });
    await new InteractionDispatcher(client).dispatch(fixture.interaction);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
});

test("acknowledges a stale command with a private unavailable response", async t => {
    const client = await HyperionClient.create({
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

test("contains synchronous throws and failed error responses in the event listener", async t => {
    const client = await HyperionClient.create({
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
