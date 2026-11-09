import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    defineCommand,
    guildOnly,
    requireBotPermissions,
    requirePermissions,
} from "@hyperion/core";
import { InteractionContextType, MessageFlags } from "discord.js";

export default defineCommand({
    // No setDefaultMemberPermissions() here, so members without the
    // permission still see the command and the guard's reply can be tried.
    builder: new ChatInputCommandBuilder()
        .setName("purge")
        .setDescription("Delete recent messages in this channel.")
        .setContexts(InteractionContextType.Guild)
        .addIntegerOptions(option =>
            option
                .setName("count")
                .setDescription("How many messages to delete")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100),
        ),
    guards: [
        guildOnly,
        requirePermissions("ManageMessages"),
        requireBotPermissions("ManageMessages", "ReadMessageHistory"),
    ],
    run: async ctx => {
        const count = ctx.interaction.options.getInteger("count", true);
        const channel = ctx.interaction.channel;

        if (!channel || !("bulkDelete" in channel)) {
            await ctx.interaction.reply({
                content: "I can't delete messages in this channel.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Discord can't bulk-delete messages older than two weeks; skip them.
        const deleted = await channel.bulkDelete(count, true);

        await ctx.interaction.editReply(
            `Deleted ${deleted.length} message${deleted.length === 1 ? "" : "s"}.`,
        );
    },
});
