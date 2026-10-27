import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion";
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
        const menu = ctx.client.selectMenus.get("user.choose");

        if (!menu) throw new Error("The user menu was not loaded.");

        await ctx.interaction.reply({
            content: "Choose a user.",
            flags: MessageFlags.Ephemeral,
            components: [new ActionRowBuilder().addComponents(menu.builder)],
        });
    }
}
