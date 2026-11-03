import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
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
        await ctx.interaction.reply({
            content: "Choose your favourite colour.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("colour.choose"),
                ),
            ],
        });
    }
}
