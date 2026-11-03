import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default class UserCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("user")
                .setDescription("Try a user select menu."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: "Choose a user.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("user.choose"),
                ),
            ],
        });
    }
}
