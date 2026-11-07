import {
    defineParams,
    defineSelectMenu,
    paramOwner,
    type SelectMenuContext,
} from "@hyperion/core";
import { ComponentType, MessageFlags } from "discord.js";
import { ticketSchema } from "../buttons/close-ticket.ts";

/** Builds the Assign menu's custom ID; the chosen user arrives with the click. */
export const assignTicket = defineParams({
    id: "ticket.assign",
    keys: ["ticketId", "owner"],
    schema: ticketSchema,
});

type AssignTicketSpec = {
    componentType: ComponentType.UserSelect;
    params: typeof assignTicket;
};

export type AssignTicketContext = SelectMenuContext<AssignTicketSpec>;

export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    params: assignTicket,
    guards: [paramOwner("owner", "Only the ticket's author can assign it.")],
    async run(ctx) {
        // Params come from the custom ID; the selection comes from the click.
        const [issues, params] = ctx.params;
        const assignee = ctx.interaction.users.first();

        if (issues || !assignee) {
            await ctx.interaction.reply({
                content: "This ticket menu is out of date.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId} assigned to ${assignee.username}.`,
            allowedMentions: { parse: [] },
        });
    },
});
