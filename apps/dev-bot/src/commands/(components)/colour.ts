import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("colour")
        .setDescription("Try a string select menu."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Choose your favourite colour.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("colour.choose"),
                ),
            ],
        });
    },
});
