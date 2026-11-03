import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, ownerOnly } from "@hyperion/core";

export default class PingCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
            guards: [ownerOnly],
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong!");
    }
}
