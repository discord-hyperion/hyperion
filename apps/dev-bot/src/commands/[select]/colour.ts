import {
    ActionRowBuilder,
    ChatInputCommandSubcommandBuilder,
} from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("colour")
        .setDescription("Try a string select menu."),
    run: async ctx => {
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
