import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, type TestContext, test } from "node:test";
import { PrimaryButtonBuilder } from "@discordjs/builders";
import {
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    Collection,
    Events,
    MessageFlags,
    type User,
} from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { Button, type ButtonContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import {
    Cooldown,
    Guard,
    type GuardProvider,
    OwnerOnly,
} from "../src/guards/index.ts";

type Phase = "new" | "defer-update" | "defer-reply" | "replied";
const interaction = (phase: Phase = "new", userId = "owner") => {
    const reply = mock.fn(async (_options: unknown) => undefined);
    const editReply = mock.fn(async (_options: unknown) => undefined);
    const followUp = mock.fn(async (_options: unknown) => undefined);
    const update = mock.fn(async (_options: unknown) => undefined);
    const showModal = mock.fn(async (_options: unknown) => undefined);
    const value = {
        id: `click-${userId}`,
        customId: "refresh",
        guildId: "test-guild",
        user: { id: userId },
        message: {
            id: "test-message",
            interactionMetadata: { user: { id: "owner" } },
        },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
        isChatInputCommand: () => false,
        isButton: () => true,
        reply,
        editReply,
        followUp,
        update,
        showModal,
        deferUpdate: mock.fn(async () => {
            value.deferred = true;
        }),
    } as unknown as ButtonInteraction;
    return { value, reply, editReply, followUp, update, showModal };
};

class TestButton extends Button {
    constructor(
        private readonly execute: (ctx: ButtonContext) => Promise<void>,
        guards: readonly GuardProvider<ButtonContext>[] = [],
    ) {
        super({
            builder: new PrimaryButtonBuilder()
                .setCustomId("refresh")
                .setLabel("Refresh"),
            guards,
        });
    }
    run(ctx: ButtonContext) {
        return this.execute(ctx);
    }
}

const setup = async (t: TestContext) => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level: "debug",
            pretty: false,
            progress: false,
            destination: {
                write: line => {
                    records.push(JSON.parse(line));
                },
            },
        },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "owner");
    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

test("button listener preserves the receiver, awaits async data, and scopes logs", async t => {
    const { client, records } = await setup(t);
    class Refresh extends TestButton {
        async run(ctx: ButtonContext) {
            assert.equal(this.customId, "refresh");
            assert.equal(ctx.client, client);
            await ctx.interaction.deferUpdate();
            const data = await Promise.resolve({ status: "Ready" });
            ctx.logger.debug({ checkpoint: "data-loaded" }, "Loaded status");
            await ctx.interaction.editReply({ content: data.status });
        }
    }
    client.buttons.set("refresh", new Refresh(async () => {}));
    const fixture = interaction();
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();
    assert.deepEqual(fixture.editReply.mock.calls[0]?.arguments[0], {
        content: "Ready",
    });
    assert.equal(fixture.value.deferred, true);
    assert.equal(fixture.reply.mock.callCount(), 0);
    const checkpoint = records.find(
        record => record.checkpoint === "data-loaded",
    );
    assert.equal(checkpoint?.button, "refresh");
    assert.equal(checkpoint?.interactionId, "click-owner");
    assert.equal(checkpoint?.userId, "owner");
    assert.ok(
        records.some(
            record =>
                record.event === "button.completed" &&
                typeof record.durationMs === "number",
        ),
    );
    assert.ok(!records.some(record => record.event === "command.completed"));
});

test("unmatched IDs and unsupported components remain available to collectors", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: ButtonContext) => {});
    client.buttons.set("refresh", new TestButton(execute));
    for (const customId of ["refresh:unmatched", "hyperion:button:expired:0"]) {
        const unknown = interaction();
        Object.assign(unknown.value, { customId });
        await dispatcher.dispatch(unknown.value);

        assert.equal(unknown.reply.mock.callCount(), 0);
        assert.equal(unknown.followUp.mock.callCount(), 0);
        assert.equal(unknown.value.deferred, false);
    }
    const select = interaction();
    Object.assign(select.value, {
        isButton: () => false,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        isModalSubmit: () => false,
    });
    await dispatcher.dispatch(select.value);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(select.reply.mock.callCount(), 0);
});

test("button guards run in order and reject before later factories or handlers", async t => {
    const { client, dispatcher, records } = await setup(t);
    const later = mock.fn(() => new OwnerOnly());
    const execute = mock.fn(async (_ctx: ButtonContext) => {});
    client.buttons.set(
        "refresh",
        new TestButton(execute, [new OwnerOnly(), later]),
    );
    const fixture = interaction("new", "other");
    await dispatcher.dispatch(fixture.value);
    assert.equal(later.mock.callCount(), 0);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.ok(records.some(record => record.event === "button.rejected"));
    assert.ok(!records.some(record => record.event === "button.completed"));
    await dispatcher.dispatch(interaction().value);
    assert.equal(execute.mock.callCount(), 1);
});

test("custom button guard onFail receives the invocation context", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<ButtonContext> {
        constructor() {
            super({ description: "No access" });
        }
        run() {
            return false;
        }
        async onFail(ctx: ButtonContext) {
            await ctx.interaction.reply("Custom rejection");
        }
    }
    const execute = mock.fn(async (_ctx: ButtonContext) => {});
    client.buttons.set(
        "refresh",
        new TestButton(execute, [async () => new Deny()]),
    );
    const fixture = interaction();
    await dispatcher.dispatch(fixture.value);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Custom rejection");
});

test("Cooldown factories share state while selecting a separate key per user", async t => {
    const { client, dispatcher } = await setup(t);
    const entries = new Collection<string, number>();
    const execute = mock.fn(async (_ctx: ButtonContext) => {});
    let now = 1_000;
    t.mock.method(Date, "now", () => now);

    const factory = mock.fn(
        (ctx: ButtonContext) =>
            new Cooldown({
                key: `refresh:${ctx.interaction.user.id}`,
                durationMs: 5_000,
                entries,
            }),
    );

    client.buttons.set("refresh", new TestButton(execute, [factory]));
    assert.equal(factory.mock.callCount(), 0);

    await dispatcher.dispatch(interaction().value);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(entries.get("refresh:owner"), 6_000);

    const repeated = interaction();
    await dispatcher.dispatch(repeated.value);
    assert.equal(execute.mock.callCount(), 1);
    assert.deepEqual(repeated.reply.mock.calls[0]?.arguments[0], {
        content: "Please wait before using this interaction again.",
        flags: MessageFlags.Ephemeral,
    });
    assert.equal(entries.get("refresh:owner"), 6_000);

    await dispatcher.dispatch(interaction("new", "another-user").value);
    assert.equal(execute.mock.callCount(), 2);

    now = 6_000;
    await dispatcher.dispatch(interaction().value);
    assert.equal(execute.mock.callCount(), 3);
    assert.equal(entries.get("refresh:owner"), 11_000);
    assert.equal(entries.has("refresh:another-user"), false);
    assert.equal(factory.mock.callCount(), 4);
    assert.notEqual(
        factory.mock.calls[0]?.result,
        factory.mock.calls[1]?.result,
    );
});

test("Cooldown rejects invalid durations", () => {
    for (const durationMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () =>
                new Cooldown({
                    key: "refresh",
                    durationMs,
                    entries: new Collection(),
                }),
            /positive, finite/,
        );
    }
});

for (const phase of [
    "new",
    "defer-update",
    "defer-reply",
    "replied",
] as const) {
    test(`button failure after ${phase} uses the correct response without overwriting a deferred update`, async t => {
        const { client, dispatcher, records } = await setup(t);
        client.buttons.set(
            "refresh",
            new TestButton(async () => {
                throw new Error("Private failure");
            }),
        );
        const fixture = interaction(phase);
        await dispatcher.dispatch(fixture.value);
        const response =
            phase === "new"
                ? fixture.reply
                : phase === "defer-reply"
                  ? fixture.editReply
                  : fixture.followUp;
        assert.equal(response.mock.callCount(), 1);
        assert.deepEqual(response.mock.calls[0]?.arguments[0], {
            content: "Something went wrong while running this button.",
            ...(phase === "defer-reply"
                ? {}
                : { flags: MessageFlags.Ephemeral }),
        });
        if (phase === "defer-update")
            assert.equal(fixture.editReply.mock.callCount(), 0);
        assert.equal(
            records.find(record => record.event === "button.failed")?.stage,
            "handler",
        );
    });
}

test("factory errors fail closed and failed error deliveries are contained", async t => {
    const { client, records } = await setup(t);
    const execute = mock.fn(async (_ctx: ButtonContext) => {});
    client.buttons.set(
        "refresh",
        new TestButton(execute, [
            async () => {
                throw new Error("Guard unavailable");
            },
        ]),
    );
    const fixture = interaction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "button.failed")?.stage,
        "guards",
    );
    assert.ok(
        records.some(record => record.event === "button.error-response.failed"),
    );
});

test("button invocations keep async state separate and never auto-acknowledge", async t => {
    const { client, dispatcher } = await setup(t);
    const contexts: ButtonContext[] = [];
    client.buttons.set(
        "refresh",
        new TestButton(async ctx => {
            contexts.push(ctx);
            const id = await Promise.resolve(ctx.interaction.user.id);
            await ctx.interaction.showModal({
                custom_id: id,
                title: "Test",
                components: [],
            });
        }),
    );
    const first = interaction("new", "first");
    const second = interaction("new", "second");
    await Promise.all([
        dispatcher.dispatch(first.value),
        dispatcher.dispatch(second.value),
    ]);
    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.showModal.mock.callCount(), 1);
    assert.equal(second.showModal.mock.callCount(), 1);
    assert.equal(first.reply.mock.callCount(), 0);
    assert.equal(first.value.deferred, false);
    assert.equal(second.value.deferred, false);
});

test("development profile command and button complete the async refresh flow", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-profile-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, file] of [
        ["commands", "profile"],
        ["buttons", "refresh-profile"],
    ] as const) {
        const directory = path.join(root, "src", folder);
        await mkdir(directory, { recursive: true });
        const url = new URL(
            `../dev/bot/src/${folder}/${file}.ts`,
            import.meta.url,
        );
        await writeFile(
            path.join(directory, `${file}.mjs`),
            `export { default } from ${JSON.stringify(url.href)};`,
        );
    }
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "owner");
    await client.commands.load(root);
    const fetch = t.mock.method(
        client.users,
        "fetch",
        async () => ({ username: "Refreshed user" }) as User,
    );
    const dispatcher = new InteractionDispatcher(client);
    const reply = mock.fn(async (_options: unknown) => undefined);
    await dispatcher.dispatch({
        id: "profile-command",
        commandName: "profile",
        user: { id: "owner" },
        isChatInputCommand: () => true,
        reply,
    } as unknown as ChatInputCommandInteraction);
    assert.equal(reply.mock.callCount(), 1);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        flags: number;
        components: { toJSON(): unknown }[];
    };
    assert.equal(payload.flags, MessageFlags.Ephemeral);
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /profile.refresh/,
    );

    const button = client.buttons.get("profile.refresh");
    const template = button?.builder.toJSON();
    const fixture = interaction();
    Object.assign(fixture.value, { customId: "profile.refresh" });
    await dispatcher.dispatch(fixture.value);
    assert.equal(fetch.mock.callCount(), 1);
    assert.deepEqual(fetch.mock.calls[0]?.arguments, [
        "owner",
        { force: true },
    ]);
    const edited = fixture.editReply.mock.calls[0]?.arguments[0] as {
        content: string;
    };
    assert.equal(edited.content, "Profile refreshed: Refreshed user");
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.deepEqual(button?.builder.toJSON(), template);
});
