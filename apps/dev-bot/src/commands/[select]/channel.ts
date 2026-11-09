import {
    ActionRowBuilder,
    ChatInputCommandSubcommandBuilder,
} from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("channel")
        .setDescription("Try a channel select menu."),
    run: async ctx => {
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
