import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion";
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
        const menu = ctx.client.selectMenus.get("channel.choose");

        if (!menu) throw new Error("The channel menu was not loaded.");

        await ctx.interaction.reply({
            content: "Choose channels.",
            flags: MessageFlags.Ephemeral,
            components: [new ActionRowBuilder().addComponents(menu.builder)],
        });
    }
}
