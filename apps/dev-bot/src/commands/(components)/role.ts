import { ActionRowBuilder, ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default class RoleCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("role")
                .setContexts(InteractionContextType.Guild)
                .setDescription("Try a role select menu."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: "Choose a role.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    ctx.client.selectMenus.build("role.choose"),
                ),
            ],
        });
    }
}
