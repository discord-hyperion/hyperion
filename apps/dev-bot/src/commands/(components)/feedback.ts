import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("feedback")
        .setDescription("Try a feedback modal."),
    async run(ctx) {
        await ctx.interaction.showModal(
            ctx.client.modals.build("feedback.submit"),
        );
    },
});
