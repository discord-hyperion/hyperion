import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion/core";

export default class ToolsPing extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong from /tools ping!");
    }
}
