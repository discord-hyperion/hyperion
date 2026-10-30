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
        const modal = ctx.client.modals.get("feedback.submit");

        if (!modal) throw new Error("The feedback modal was not loaded.");

        await ctx.interaction.showModal(modal.builder);
    }
}
