import { MessageContextCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new MessageContextCommandBuilder().setName("Inspect"),
    run: async ctx => {
        const message = ctx.interaction.targetMessage;

        await ctx.interaction.reply({
            content: `Message: ${message.id}. Author: ${message.author.username}.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
