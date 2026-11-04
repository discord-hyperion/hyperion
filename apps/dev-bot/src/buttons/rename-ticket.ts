import {
    type ButtonContext,
    ButtonHandler,
    defineParams,
    paramOwner,
} from "@hyperion/core";
import { MessageFlags } from "discord.js";
import { renameTicketForm } from "../modals/rename-ticket.ts";
import { ticketSchema } from "./close-ticket.ts";

/** Builds the Rename button's custom ID and declares how to read it back. */
export const renameTicket = defineParams({
    id: "ticket.rename",
    keys: ["ticketId", "owner"],
    schema: ticketSchema,
});

type RenameTicketButtonSpec = { params: typeof renameTicket };

export default class RenameTicketButton extends ButtonHandler<RenameTicketButtonSpec> {
    constructor() {
        super({
            params: renameTicket,
            guards: [
                paramOwner("owner", "Only the ticket's author can rename it."),
            ],
        });
    }

    async run(ctx: ButtonContext<RenameTicketButtonSpec>) {
        const [issues, params] = ctx.params;

        if (issues) {
            await ctx.interaction.reply({
                content: "This ticket button is out of date.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        // Carry the ticket into the modal's custom ID; the submission reads it back.
        await ctx.interaction.showModal(
            ctx.client.modals.build(renameTicketForm, params),
        );
    }
}
