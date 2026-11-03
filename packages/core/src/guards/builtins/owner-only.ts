import type { InteractionContext } from "../../contexts/index.ts";
import { defineGuard } from "../guard.ts";

/** Rejects everyone except the bot application's owner. */
export const ownerOnly = defineGuard<InteractionContext>({
    name: "owner-only",
    description: "Only the bot application's owner can use this interaction.",
    run: async ctx => {
        const ownerId = await ctx.client.getOwnerId();

        return ownerId === ctx.interaction.user.id;
    },
});
