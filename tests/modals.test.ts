import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import {
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import {
    type ChatInputCommandInteraction,
    Events,
    MessageFlags,
    type ModalSubmitInteraction,
    TextInputStyle,
} from "discord.js";
import {
    Guard,
    type GuardProvider,
    HyperionClient,
    InteractionDispatcher,
    Modal,
    type ModalContext,
    OwnerOnly,
    SelectMenu,
} from "../src/index.ts";

class TestModal extends Modal {
    constructor(
        private readonly execute: (ctx: ModalContext) => Promise<void>,
        guards: readonly GuardProvider<ModalContext>[] = [],
    ) {
        super({
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
    const reply = mock.fn(async (_payload: unknown) => {});
    const editReply = mock.fn(async (_payload: unknown) => {});
    const followUp = mock.fn(async (_payload: unknown) => {});
    const update = mock.fn(async (_payload: unknown) => {});
    const getTextInputValue = mock.fn((_customId: string) => message);
    const value = {
        id: "modal-submission",
        customId: "feedback.submit",
        components: { getTextInputValue },
        user: { id: "caller" },
        guildId: "guild",
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
        isChatInputCommand: () => false,
        isButton: () => false,
        isSelectMenu: () => false,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        isModalSubmit: () => true,
        isFromMessage: () => false,
        reply,
        editReply,
        followUp,
        update,
    } as unknown as ModalSubmitInteraction;

    return { value, reply, editReply, followUp, update, getTextInputValue };
};

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
                write: line => records.push(JSON.parse(line)),
            },
        },
    });
    t.after(() => client.destroy());

    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

test("modal listener runs once with its receiver, v15 components, and scoped logs", async t => {
    const { client, records } = await setup(t);
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
    client.emit(Events.InteractionCreate, fixture.value);
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
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: ModalContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.modals.set("feedback.submit", new TestModal(execute, [factory]));
    const fixture = interaction();
    Object.assign(fixture.value, { customId: "feedback.submit:other" });
    await dispatcher.dispatch(fixture.value);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.equal(fixture.value.deferred, false);
});

test("embedded selects are resolved by the modal without invoking message select handlers", async t => {
    const { client, dispatcher } = await setup(t);
    const builder = new StringSelectMenuBuilder()
        .setCustomId("colour.choose")
        .addOptions({ label: "Blue", value: "blue" });
    const execute = mock.fn(async () => {});
    class MessageMenu extends SelectMenu {
        constructor() {
            super({ builder });
        }
        run() {
            return execute();
        }
    }
    class EmbeddedModal extends Modal {
        constructor() {
            super({
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
    assert.match(JSON.stringify(modal.builder.toJSON()), /colour.choose/);
    client.modals.set(modal.customId, modal);
    const fixture = interaction();
    const getStringSelectValues = mock.fn((_customId: string) => ["blue"]);
    Object.assign(fixture.value.components, { getStringSelectValues });
    await dispatcher.dispatch(fixture.value);

    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(getStringSelectValues.mock.calls[0]?.arguments, [
        "colour.choose",
    ]);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "blue");
});

test("modal guards run lazily in order and shared OwnerOnly guards work", async t => {
    const { client, dispatcher } = await setup(t);
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
    await dispatcher.dispatch(denied.value);
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
    Object.assign(allowed.value, { user: { id: "owner" } });
    await dispatcher.dispatch(allowed.value);
    assert.equal(factory.mock.callCount(), 2);
    assert.equal(later.mock.callCount(), 1);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(allowed.reply.mock.callCount(), 0);
});

test("modal custom rejection owns the response and guards are snapshotted", async t => {
    const { client, dispatcher } = await setup(t);
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
    await dispatcher.dispatch(fixture.value);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Custom rejection");
});

for (const stage of ["handler", "guards"] as const) {
    for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
        test(`modal ${stage} failures respect ${phase} acknowledgment`, async t => {
            const { client, dispatcher, records } = await setup(t);
            const fail = async () => {
                throw new Error("Private failure");
            };
            client.modals.set(
                "feedback.submit",
                new TestModal(fail, stage === "guards" ? [fail] : []),
            );
            const fixture = interaction(phase);
            if (phase === "defer-update") {
                Object.assign(fixture.value, { isFromMessage: () => true });
            }
            await dispatcher.dispatch(fixture.value);

            const response =
                phase === "new"
                    ? fixture.reply
                    : phase === "defer-reply"
                      ? fixture.editReply
                      : fixture.followUp;
            assert.equal(response.mock.callCount(), 1);
            assert.deepEqual(response.mock.calls[0]?.arguments[0], {
                content: "Something went wrong while running this modal.",
                ...(phase === "defer-reply"
                    ? {}
                    : { flags: MessageFlags.Ephemeral }),
            });
            if (phase === "defer-update")
                assert.equal(fixture.editReply.mock.callCount(), 0);
            assert.equal(
                records.find(record => record.event === "modal.failed")?.stage,
                stage,
            );
        });
    }
}

test("failed modal error delivery is contained by the interaction listener", async t => {
    const { client, records } = await setup(t);
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
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();

    assert.ok(
        records.some(record => record.event === "modal.error-response.failed"),
    );
});

test("concurrent modal submissions receive independent contexts without automatic acknowledgment", async t => {
    const { client, dispatcher } = await setup(t);
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
        dispatcher.dispatch(first.value),
        dispatcher.dispatch(second.value),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.reply.mock.calls[0]?.arguments[0], "first");
    assert.equal(second.reply.mock.calls[0]?.arguments[0], "second");
    assert.equal(first.reply.mock.callCount(), 1);
    assert.equal(first.value.deferred, false);
    assert.equal(second.value.deferred, false);
});

test("development feedback command opens the modal and its filesystem handler processes submission", async t => {
    const root = new URL("../dev/bot/", import.meta.url);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const showModal = mock.fn(async (_payload: unknown) => {});
    const reply = mock.fn(async (_payload: unknown) => {});
    const dispatcher = new InteractionDispatcher(client);
    await dispatcher.dispatch({
        id: "feedback-command",
        commandName: "feedback",
        user: { id: "caller" },
        isChatInputCommand: () => true,
        showModal,
        reply,
    } as unknown as ChatInputCommandInteraction);

    assert.equal(showModal.mock.callCount(), 1);
    assert.equal(reply.mock.callCount(), 0);
    const modal = client.modals.get("feedback.submit");
    assert.ok(modal);
    assert.equal(showModal.mock.calls[0]?.arguments[0], modal.builder);
    const template = modal.builder.toJSON();
    assert.match(JSON.stringify(template), /feedback.message/);
    const fixture = interaction("new", "Hello");
    await dispatcher.dispatch(fixture.value);

    assert.deepEqual(fixture.getTextInputValue.mock.calls[0]?.arguments, [
        "feedback.message",
    ]);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content:
            "Received 5 characters of feedback. This demo does not store submissions.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    assert.deepEqual(modal.builder.toJSON(), template);
});
