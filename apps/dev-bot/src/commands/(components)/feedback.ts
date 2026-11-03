import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";

export default class FeedbackCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("feedback")
                .setDescription("Try a feedback modal."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.showModal(
            ctx.client.modals.build("feedback.submit"),
        );
    }
}
