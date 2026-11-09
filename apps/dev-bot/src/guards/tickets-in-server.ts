import { defineGuard, type InteractionContext } from "@hyperion/core";
import { MessageFlags } from "discord.js";

/**
 * Like the built-in guildOnly, but with its own private reply, to show
 * onFail().
 */
export const ticketsInServer = defineGuard<InteractionContext>({
    name: "tickets-in-server",
    description: "Use this in a server.",
    run: ctx => ctx.interaction.inGuild(),
    onFail: async ctx => {
        if (!ctx.interaction.isRepliable()) return;

        await ctx.interaction.reply({
            content: "Tickets belong to a server. Run this there instead.",
            flags: MessageFlags.Ephemeral,
        });
    },
});
