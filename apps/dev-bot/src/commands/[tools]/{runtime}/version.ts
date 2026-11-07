import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("version")
        .setDescription("Show the Node.js version running the bot"),
    async run(ctx) {
        await ctx.interaction.reply({
            content: `Node.js version: ${process.version}.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
