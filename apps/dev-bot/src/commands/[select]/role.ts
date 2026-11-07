import {
    ActionRowBuilder,
    ChatInputCommandSubcommandBuilder,
} from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("role")
        .setDescription("Try a role select menu."),
    async run(ctx) {
        await ctx.interaction.reply({
            content: "Choose a role.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("role.choose"),
                ),
            ],
        });
    },
});
