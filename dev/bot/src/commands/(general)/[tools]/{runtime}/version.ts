import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion";
import { MessageFlags } from "discord.js";

export default class Version extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("version")
                .setDescription("Show the Node.js version running the bot"),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: `Node.js version: ${process.version}.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
