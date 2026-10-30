import {
    ActionRowBuilder,
    ChatInputCommandBuilder,
    SecondaryButtonBuilder,
} from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default class ProfileCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("profile")
                .setDescription(
                    "Try a button that fetches fresh profile data.",
                ),
        });
    }

    async run(ctx: CommandContext) {
        const button = ctx.client.buttons.get("profile.refresh");

        if (!button)
            throw new Error("The refresh-profile button was not loaded.");

        await ctx.interaction.reply({
            content: "Press refresh to load your profile.",
            flags: MessageFlags.Ephemeral,
            components: [
                new ActionRowBuilder().addComponents(
                    button.builder,
                    new SecondaryButtonBuilder()
                        .setCustomId("profile.last-fetched")
                        .setLabel("Not fetched yet")
                        .setDisabled(true),
                ),
            ],
        });
    }
}
