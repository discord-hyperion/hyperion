import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import { Modal, type ModalContext } from "@hyperion/core";
import { MessageFlags, TextInputStyle } from "discord.js";

export default class SubmitFeedback extends Modal {
    constructor() {
        super({
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
        });
    }

    async run(ctx: ModalContext) {
        const message =
            ctx.interaction.components.getTextInputValue("feedback.message");

        await ctx.interaction.reply({
            content: `Received ${message.length} characters of feedback. This demo does not store submissions.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
