import { defineGuard, type InteractionContext } from "@hyperion/core";
import { MessageFlags } from "discord.js";

/** Rejects interactions outside a server, with its own private reply. */
export const guildOnly = defineGuard<InteractionContext>({
    name: "guild-only",
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
