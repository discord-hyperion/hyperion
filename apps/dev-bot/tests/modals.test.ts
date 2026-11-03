import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { ModalBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { MessageFlags } from "discord.js";

import {
    createChatInputInteraction,
    createModalInteraction,
} from "../../../tests/fixtures/interactions.ts";

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

test("development feedback command opens the modal and its filesystem handler processes submission", async t => {
    const root = new URL("../", import.meta.url);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const {
        interaction: commandInteraction,
        showModal,
        reply,
    } = createChatInputInteraction({
        id: "feedback-command",
        commandName: "feedback",
        user: { id: "caller" },
    });
    const dispatcher = new InteractionDispatcher(client);
    await dispatcher.dispatch(commandInteraction);

    assert.equal(showModal.mock.callCount(), 1);
    assert.equal(reply.mock.callCount(), 0);
    const modal = client.modals.get("feedback.submit");
    assert.ok(modal);
    const shown = showModal.mock.calls[0]?.arguments[0] as ModalBuilder;
    // The command shows a fresh copy of the form, never the shared template.
    assert.notEqual(shown, modal.builder);
    assert.equal(shown.toJSON().custom_id, "feedback.submit");
    const template = modal.builder?.toJSON(false);
    assert.match(JSON.stringify(template), /feedback.message/);
    const fixture = interaction("new", "Hello");
    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(fixture.getTextInputValue.mock.calls[0]?.arguments, [
        "feedback.message",
    ]);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content:
            "Received 5 characters of feedback. This demo does not store submissions.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    assert.deepEqual(modal.builder?.toJSON(false), template);
});
