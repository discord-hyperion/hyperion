import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import {
    ComponentType,
    Events,
    MessageFlags,
    TextInputStyle,
} from "discord.js";
import { createModalInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    Guard,
    type GuardProvider,
    type ModalContext,
    ModalHandler,
    OwnerOnly,
    SelectMenuHandler,
} from "../src/index.ts";
import { assertPrivateFailure, phases } from "./support/acknowledgment.ts";
import { createTestClient } from "./support/test-client.ts";

class TestModal extends ModalHandler {
    constructor(
        private readonly execute: (ctx: ModalContext) => Promise<void>,
        guards: readonly GuardProvider<ModalContext>[] = [],
    ) {
        super({
            customId: "feedback.submit",
            builder: new ModalBuilder()
                .setCustomId("feedback.submit")
                .setTitle("Feedback")
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel("Message")
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId("feedback.message")
                                .setStyle(TextInputStyle.Paragraph),
                        ),
                ),
            guards,
        });
    }

    run(ctx: ModalContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", message = "Private submitted text") => {
    const getTextInputValue = mock.fn((_customId: string) => message);
    return {
        ...createModalInteraction({
            id: "modal-submission",
            customId: "feedback.submit",
            components: { getTextInputValue },
            user: { id: "caller" },
            guildId: "guild",
            deferred: phase.startsWith("defer"),
            replied: phase === "replied",
            ephemeral: phase === "defer-reply" ? true : null,
            ...(phase === "defer-update"
                ? { message: { id: "source-message" } }
                : {}),
        }),
        getTextInputValue,
    };
};

test("modal listener runs once with its receiver, v15 components, and scoped logs", async t => {
    const { client, records } = await createTestClient(t);
    class Inspect extends TestModal {
        async run(ctx: ModalContext) {
            assert.equal(this.customId, "feedback.submit");
            assert.equal(ctx.client, client);
            assert.equal(
                ctx.interaction.components.getTextInputValue(
                    "feedback.message",
                ),
                "Private submitted text",
            );
            await ctx.interaction.reply(await Promise.resolve("Received"));
        }
    }
    client.modals.set("feedback.submit", new Inspect(async () => {}));
    const fixture = interaction();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Received");
    const completed = records.find(
        record => record.event === "modal.completed",
    );
    assert.equal(completed?.modal, "feedback.submit");
    assert.equal(completed?.interactionId, "modal-submission");
    assert.equal(completed?.guildId, "guild");
    assert.equal(completed?.userId, "caller");
    assert.equal(typeof completed?.durationMs, "number");
    assert.ok(!JSON.stringify(records).includes("Private submitted text"));
});

test("unmatched modal IDs leave submissions to collectors without running guards", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const execute = mock.fn(async (_ctx: ModalContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.modals.set("feedback.submit", new TestModal(execute, [factory]));
    const fixture = interaction();
    Object.assign(fixture.interaction, { customId: "feedback.submit:other" });
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.equal(fixture.interaction.deferred, false);
});

test("embedded selects are resolved by the modal without invoking message select handlers", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const builder = new StringSelectMenuBuilder()
        .setCustomId("colour.choose")
        .addOptions({ label: "Blue", value: "blue" });
    const execute = mock.fn(async () => {});
    class MessageMenu extends SelectMenuHandler {
        constructor() {
            super({
                customId: "colour.choose",
                componentType: ComponentType.StringSelect,
                builder,
            });
        }
        run() {
            return execute();
        }
    }
    class EmbeddedModal extends ModalHandler {
        constructor() {
            super({
                customId: "feedback.submit",
                builder: new ModalBuilder()
                    .setCustomId("feedback.submit")
                    .setTitle("Choose a colour")
                    .addLabelComponents(
                        new LabelBuilder()
                            .setLabel("Colour")
                            .setStringSelectMenuComponent(builder),
                    ),
            });
        }
        async run(ctx: ModalContext) {
            await ctx.interaction.reply(
                ctx.interaction.components
                    .getStringSelectValues("colour.choose")
                    .join(", "),
            );
        }
    }
    client.selectMenus.set("colour.choose", new MessageMenu());
    const modal = new EmbeddedModal();
    assert.match(JSON.stringify(modal.builder?.toJSON()), /colour.choose/);
    client.modals.set(modal.customId, modal);
    const fixture = interaction();
    const getStringSelectValues = mock.fn((_customId: string) => ["blue"]);
    Object.assign(fixture.interaction.components, { getStringSelectValues });
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(getStringSelectValues.mock.calls[0]?.arguments, [
        "colour.choose",
    ]);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "blue");
});

test("modal guards run lazily in order and shared OwnerOnly guards work", async t => {
    const { client, dispatcher } = await createTestClient(t);
    t.mock.method(client, "getOwnerId", async () => "owner");
    const execute = mock.fn(async (_ctx: ModalContext) => {});
    const factory = mock.fn(async (ctx: ModalContext) => {
        assert.equal(
            ctx.interaction.components.getTextInputValue("feedback.message"),
            "Private submitted text",
        );
        return new OwnerOnly();
    });
    const later = mock.fn(() => new OwnerOnly());
    client.modals.set(
        "feedback.submit",
        new TestModal(execute, [factory, later]),
    );
    assert.equal(factory.mock.callCount(), 0);

    const denied = interaction();
    await dispatcher.dispatch(denied.interaction);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(later.mock.callCount(), 0);
    assert.equal(denied.reply.mock.callCount(), 1);
    assert.equal(
        (
            denied.reply.mock.calls[0]?.arguments[0] as
                | { flags: number }
                | undefined
        )?.flags,
        MessageFlags.Ephemeral,
    );

    const allowed = interaction();
    Object.assign(allowed.interaction, { user: { id: "owner" } });
    await dispatcher.dispatch(allowed.interaction);
    assert.equal(factory.mock.callCount(), 2);
    assert.equal(later.mock.callCount(), 1);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(allowed.reply.mock.callCount(), 0);
});

test("modal custom rejection owns the response and guards are snapshotted", async t => {
    const { client, dispatcher } = await createTestClient(t);
    class Deny extends Guard<ModalContext> {
        constructor() {
            super({ description: "Denied" });
        }
        run() {
            return false;
        }
        async onFail(ctx: ModalContext) {
            await ctx.interaction.reply("Custom rejection");
        }
    }
    const execute = mock.fn(async (_ctx: ModalContext) => {});
    const guards: GuardProvider<ModalContext>[] = [new Deny()];
    const modal = new TestModal(execute, guards);
    guards.length = 0;
    assert.ok(Object.isFrozen(modal.guards));
    client.modals.set(modal.customId, modal);
    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Custom rejection");
});

for (const stage of ["handler", "guards"] as const) {
    test(`modal ${stage} failures respect every acknowledgment phase`, async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const fail = async () => {
            throw new Error("Private failure");
        };
        client.modals.set(
            "feedback.submit",
            new TestModal(fail, stage === "guards" ? [fail] : []),
        );

        for (const phase of phases) {
            const fixture = interaction(phase);
            await dispatcher.dispatch(fixture.interaction);

            assertPrivateFailure(
                fixture,
                phase,
                "Something went wrong while running this modal.",
            );
        }

        assert.equal(
            records.find(record => record.event === "modal.failed")?.stage,
            stage,
        );
    });
}

test("failed modal error delivery is contained by the interaction listener", async t => {
    const { client, records } = await createTestClient(t);
    client.modals.set(
        "feedback.submit",
        new TestModal(async () => {
            throw new Error("Handler unavailable");
        }),
    );
    const fixture = interaction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.ok(
        records.some(record => record.event === "modal.error-response.failed"),
    );
});

test("concurrent modal submissions receive independent contexts without automatic acknowledgment", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const contexts: ModalContext[] = [];
    client.modals.set(
        "feedback.submit",
        new TestModal(async ctx => {
            contexts.push(ctx);
            const message = await Promise.resolve(
                ctx.interaction.components.getTextInputValue(
                    "feedback.message",
                ),
            );
            await ctx.interaction.reply(message);
        }),
    );
    const first = interaction("new", "first");
    const second = interaction("new", "second");
    await Promise.all([
        dispatcher.dispatch(first.interaction),
        dispatcher.dispatch(second.interaction),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.reply.mock.calls[0]?.arguments[0], "first");
    assert.equal(second.reply.mock.calls[0]?.arguments[0], "second");
    assert.equal(first.reply.mock.callCount(), 1);
    assert.equal(first.interaction.deferred, false);
    assert.equal(second.interaction.deferred, false);
});
