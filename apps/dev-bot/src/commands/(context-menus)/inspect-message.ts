import { MessageContextCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { type ApplicationCommandType, MessageFlags } from "discord.js";

export default class InspectMessage extends Command<ApplicationCommandType.Message> {
    constructor() {
        super({
            builder: new MessageContextCommandBuilder().setName("Inspect"),
        });
    }

    async run(ctx: CommandContext<ApplicationCommandType.Message>) {
        const message = ctx.interaction.targetMessage;

        await ctx.interaction.reply({
            content: `Message: ${message.id}. Author: ${message.author.username}.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
