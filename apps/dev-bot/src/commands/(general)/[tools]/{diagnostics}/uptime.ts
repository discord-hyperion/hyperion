import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default class Uptime extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("uptime")
                .setDescription("Show how long this process has been running"),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: `Process uptime: ${Math.floor(process.uptime())} seconds.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
