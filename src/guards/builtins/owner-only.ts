import type { InteractionContext } from "../../contexts/index.ts";
import { Guard } from "../guard.ts";

export class OwnerOnly extends Guard<InteractionContext> {
    constructor() {
        super({
            name: "owner-only",
            description:
                "Only the bot application's owner can use this interaction.",
        });
    }

    async run(ctx: InteractionContext) {
        const ownerId = await ctx.client.getOwnerId();

        return ownerId === ctx.interaction.user.id;
    }
}
