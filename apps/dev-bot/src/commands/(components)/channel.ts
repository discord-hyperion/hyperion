import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("channel")
        .setContexts(InteractionContextType.Guild)
        .setDescription("Try a channel select menu."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Choose channels.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("channel.choose"),
                ),
            ],
        });
    },
});
