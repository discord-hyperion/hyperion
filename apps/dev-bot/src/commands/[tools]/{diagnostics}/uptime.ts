import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("uptime")
        .setDescription("Show how long this process has been running"),
    run: async ctx => {
        await ctx.interaction.reply({
            content: `Process uptime: ${Math.floor(process.uptime())} seconds.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
