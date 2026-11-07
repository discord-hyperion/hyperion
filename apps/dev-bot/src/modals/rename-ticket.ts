import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import {
    defineInput,
    defineModal,
    defineParams,
    type ModalContext,
    paramOwner,
} from "@hyperion/core";
import { MessageFlags, TextInputStyle } from "discord.js";
import * as v from "valibot";
import { ticketSchema } from "../buttons/close-ticket.ts";

/** The ticket travels in the modal's custom ID; the new title comes from the form. */
export const renameTicketForm = defineParams({
    id: "ticket.rename-form",
    keys: ["ticketId", "owner"],
    schema: ticketSchema,
});

const input = defineInput({
    schema: v.object({
        title: v.pipe(
            v.string(),
            v.trim(),
            v.minLength(1, "The title must not be blank."),
            v.maxLength(100),
        ),
    }),
});

type RenameTicketSpec = {
    params: typeof renameTicketForm;
    input: typeof input;
};

export type RenameTicketContext = ModalContext<RenameTicketSpec>;

export default defineModal({
    params: renameTicketForm,
    // The form stays with the handler because `input` reads its text-input IDs.
    builder: new ModalBuilder()
        .setCustomId(renameTicketForm.id)
        .setTitle("Rename ticket")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("New title")
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("title")
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(100),
                ),
        ),
    input,
    // The submission is a separate interaction, so ownership is checked again.
    guards: [paramOwner("owner", "Only the ticket's author can rename it.")],
    async run(ctx) {
        const [paramIssues, params] = ctx.params;
        const [inputIssues, value] = ctx.input;

        if (paramIssues || !ctx.interaction.isFromMessage()) {
            await ctx.interaction.reply({
                content: "This ticket form is out of date.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (inputIssues) {
            await ctx.interaction.reply({
                content: inputIssues.map(issue => issue.message).join("\n"),
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });

            return;
        }

        await ctx.interaction.update({
            content: `Ticket ${params.ticketId}: ${value.title}`,
            allowedMentions: { parse: [] },
        });
    },
});
