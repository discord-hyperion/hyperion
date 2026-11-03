import {
    Button,
    type ButtonContext,
    defineParams,
    ParamOwner,
} from "@hyperion/core";
import { MessageFlags } from "discord.js";
import * as v from "valibot";

/** The values every ticket control carries in its custom ID. */
export const ticketSchema = v.object({
    ticketId: v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/)),
    owner: v.string(),
});

/** Builds the Close button's custom ID and declares how to read it back. */
export const closeTicket = defineParams({
    id: "ticket.close",
    keys: ["ticketId", "owner"],
    schema: ticketSchema,
});

export type CloseTicketContext = ButtonContext<typeof closeTicket>;

export default class CloseTicketButton extends Button<typeof closeTicket> {
    constructor() {
        super({
            params: closeTicket,
            // The custom ID is client-controlled, so ownership is checked on every click.
            guards: [
                new ParamOwner(
                    "owner",
                    "Only the ticket's author can close it.",
                ),
            ],
        });
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
