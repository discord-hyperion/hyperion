import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { defineModal } from "@hyperion-js/core";
import { MessageFlags, TextInputStyle } from "discord.js";

export default defineModal({
    builder: new ModalBuilder()
        .setCustomId("feedback.submit")
        .setTitle("Feedback")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Your feedback")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("feedback.message")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1_000),
                ),
        ),
    run: async ctx => {
        const message =
            ctx.interaction.components.getTextInputValue("feedback.message");

        await ctx.interaction.reply({
            content: `Received ${message.length} characters of feedback. This demo does not store submissions.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
