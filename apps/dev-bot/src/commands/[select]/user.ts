import {
    ActionRowBuilder,
    ChatInputCommandSubcommandBuilder,
} from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("user")
        .setDescription("Try a user select menu."),
    run: async ctx => {
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
