import {
    ActionRowBuilder,
    ChatInputCommandBuilder,
    SecondaryButtonBuilder,
} from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("profile")
        .setDescription("Try a button that fetches fresh profile data."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Press refresh to load your profile.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.buttons.build("profile.refresh"),
                    new SecondaryButtonBuilder()
                        .setCustomId("profile.last-fetched")
                        .setLabel("Not fetched yet")
                        .setDisabled(true),
                ),
            ],
        });
    },
});
