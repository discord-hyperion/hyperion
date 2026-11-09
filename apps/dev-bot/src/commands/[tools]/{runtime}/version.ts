import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("version")
        .setDescription("Show the Node.js version running the bot"),
    run: async ctx => {
        await ctx.interaction.reply({
            content: `Node.js version: ${process.version}.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
