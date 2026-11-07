import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("mentionable")
        .setContexts(InteractionContextType.Guild)
        .setDescription("Try selecting users and roles together."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Choose up to five users or roles.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("mentionable.choose"),
                ),
            ],
        });
    },
});
