import { MessageContextCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new MessageContextCommandBuilder().setName("Inspect"),
    async run(ctx) {
        const message = ctx.interaction.targetMessage;

        await ctx.interaction.reply({
            content: `Message: ${message.id}. Author: ${message.author.username}.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
