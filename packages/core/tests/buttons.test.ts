import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { Collection, Events, InteractionType, MessageFlags } from "discord.js";
import { createButtonInteraction } from "../../../tests/fixtures/interactions.ts";
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
const interaction = (phase: Phase = "new", userId = "owner") =>
    createButtonInteraction({
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
    });

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
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();
    assert.deepEqual(fixture.editReply.mock.calls[0]?.arguments[0], {
        content: "Ready",
    });
    assert.equal(fixture.interaction.deferred, true);
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
        Object.assign(unknown.interaction, { customId });
        await dispatcher.dispatch(unknown.interaction);

        assert.equal(unknown.reply.mock.callCount(), 0);
        assert.equal(unknown.followUp.mock.callCount(), 0);
        assert.equal(unknown.interaction.deferred, false);
    }
    const select = interaction();
    // Deliberately unsupported interaction remains available to collectors.
    Object.assign(select.interaction, { type: InteractionType.Ping });
    await dispatcher.dispatch(select.interaction);
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
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(later.mock.callCount(), 0);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.ok(records.some(record => record.event === "button.rejected"));
    assert.ok(!records.some(record => record.event === "button.completed"));
    await dispatcher.dispatch(interaction().interaction);
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
    await dispatcher.dispatch(fixture.interaction);
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

    await dispatcher.dispatch(interaction().interaction);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(entries.get("refresh:owner"), 6_000);

    const repeated = interaction();
    await dispatcher.dispatch(repeated.interaction);
    assert.equal(execute.mock.callCount(), 1);
    assert.deepEqual(repeated.reply.mock.calls[0]?.arguments[0], {
        content: "Please wait before using this interaction again.",
        flags: MessageFlags.Ephemeral,
    });
    assert.equal(entries.get("refresh:owner"), 6_000);

    await dispatcher.dispatch(interaction("new", "another-user").interaction);
    assert.equal(execute.mock.callCount(), 2);

    now = 6_000;
    await dispatcher.dispatch(interaction().interaction);
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
        await dispatcher.dispatch(fixture.interaction);
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
    client.emit(Events.InteractionCreate, fixture.interaction);
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
        dispatcher.dispatch(first.interaction),
        dispatcher.dispatch(second.interaction),
    ]);
    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.showModal.mock.callCount(), 1);
    assert.equal(second.showModal.mock.callCount(), 1);
    assert.equal(first.reply.mock.callCount(), 0);
    assert.equal(first.interaction.deferred, false);
    assert.equal(second.interaction.deferred, false);
});
