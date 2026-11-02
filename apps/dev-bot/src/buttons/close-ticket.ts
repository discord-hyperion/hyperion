import {
    Button,
    type ButtonContext,
    defineParams,
    Guard,
} from "@hyperion/core";
import { MessageFlags } from "discord.js";
import * as v from "valibot";

/** Builds the Close button's custom ID and declares how to read it back. */
export const closeTicket = defineParams({
    id: "ticket.close",
    keys: ["ticketId", "owner"],
    schema: v.object({
        ticketId: v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/)),
        owner: v.string(),
    }),
});

export type CloseTicketContext = ButtonContext<typeof closeTicket>;

/** The custom ID is client-controlled, so ownership is checked on every click. */
class TicketOwner extends Guard<CloseTicketContext> {
    constructor() {
        super({ description: "Only the ticket's author can close it." });
    }

    run(ctx: CloseTicketContext) {
        const [issues, params] = ctx.params;

        return !issues && params.owner === ctx.interaction.user.id;
    }
}

export default class CloseTicketButton extends Button<typeof closeTicket> {
    constructor() {
        super({ params: closeTicket, guards: [new TicketOwner()] });
    }

    async run(ctx: CloseTicketContext) {
        const [issues, params] = ctx.params;

        if (issues) {
            await ctx.interaction.reply({
                content: "This ticket button is out of date.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId} closed.`,
            components: [],
        });
    }
}
