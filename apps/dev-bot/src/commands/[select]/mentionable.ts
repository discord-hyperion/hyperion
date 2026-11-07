import {
    ActionRowBuilder,
    ChatInputCommandSubcommandBuilder,
} from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("mentionable")
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
