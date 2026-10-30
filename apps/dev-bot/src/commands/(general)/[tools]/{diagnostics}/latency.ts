import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default class Latency extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("latency")
                .setDescription("Show the bot's gateway heartbeat latency"),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content:
                ctx.client.ping === null
                    ? "Gateway latency is not available yet."
                    : `Gateway latency: ${Math.round(ctx.client.ping)} ms.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
