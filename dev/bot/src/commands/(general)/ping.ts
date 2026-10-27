import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, OwnerOnly } from "@hyperion";

export default class PingCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
            guards: [new OwnerOnly()],
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong!");
    }
}
