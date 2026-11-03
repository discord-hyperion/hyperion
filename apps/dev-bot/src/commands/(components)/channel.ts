import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default class ChannelCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("channel")
                .setContexts(InteractionContextType.Guild)
                .setDescription("Try a channel select menu."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: "Choose channels.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("channel.choose"),
                ),
            ],
        });
    }
}
