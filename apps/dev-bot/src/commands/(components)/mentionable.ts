import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default class MentionableCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("mentionable")
                .setContexts(InteractionContextType.Guild)
                .setDescription("Try selecting users and roles together."),
        });
    }

    async run(ctx: CommandContext) {
        const menu = ctx.client.selectMenus.get("mentionable.choose");

        if (!menu) throw new Error("The mentionable menu was not loaded.");

        await ctx.interaction.reply({
            content: "Choose up to five users or roles.",
            flags: MessageFlags.Ephemeral,
            components: [new ActionRowBuilder().addComponents(menu.builder)],
        });
    }
}
