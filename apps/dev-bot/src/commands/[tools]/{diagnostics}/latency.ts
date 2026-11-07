import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("latency")
        .setDescription("Show the bot's gateway heartbeat latency"),
    async run(ctx) {
        await ctx.interaction.reply({
            content:
                ctx.client.ping === null
                    ? "Gateway latency is not available yet."
                    : `Gateway latency: ${Math.round(ctx.client.ping)} ms.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
