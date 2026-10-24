import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion";

export default class PingCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
        });
    }

    public override async run(ctx: CommandContext): Promise<void> {
        await ctx.interaction.reply("Pong!");
    }
}
