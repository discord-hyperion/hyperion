import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion";
import { MessageFlags } from "discord.js";

export default class ColourCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("colour")
                .setDescription("Try a string select menu."),
        });
    }

    async run(ctx: CommandContext) {
        const menu = ctx.client.selectMenus.get("colour.choose");

        if (!menu) throw new Error("The colour menu was not loaded.");

        await ctx.interaction.reply({
            content: "Choose your favourite colour.",
            flags: MessageFlags.Ephemeral,
            components: [new ActionRowBuilder().addComponents(menu.builder)],
        });
    }
}
