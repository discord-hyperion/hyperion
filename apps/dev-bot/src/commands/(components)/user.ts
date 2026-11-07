import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("user")
        .setDescription("Try a user select menu."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Choose a user.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("user.choose"),
                ),
            ],
        });
    },
});
