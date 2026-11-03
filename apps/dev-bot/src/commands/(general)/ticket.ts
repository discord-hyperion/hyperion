import { randomBytes } from "node:crypto";
import {
    ActionRowBuilder,
    ChatInputCommandBuilder,
    DangerButtonBuilder,
    SecondaryButtonBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { closeTicket } from "../../buttons/close-ticket.ts";
import { renameTicket } from "../../buttons/rename-ticket.ts";
import { assignTicket } from "../../select-menus/assign-ticket.ts";

export default class TicketCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ticket")
                .setDescription(
                    "Open a ticket with Assign, Close, and Rename controls.",
                )
                .addStringOptions(option =>
                    option
                        .setName("subject")
                        .setDescription("What the ticket is about")
                        .setRequired(true)
                        .setMaxLength(100),
                ),
        });
    }

    async run(ctx: CommandContext) {
        const subject = ctx.interaction.options.getString("subject", true);
        // Handlers stay stateless: the ticket's identity travels in each control.
        const ticket = {
            ticketId: randomBytes(4).toString("hex"),
            owner: ctx.interaction.user.id,
        };

        await ctx.interaction.reply({
            content: `Ticket ${ticket.ticketId}: ${subject}`,
            allowedMentions: { parse: [] },
            components: [
                new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId(assignTicket(ticket))
                        .setPlaceholder("Assign to…"),
                ),
                new ActionRowBuilder().addComponents(
                    new DangerButtonBuilder()
                        .setLabel("Close")
                        .setCustomId(closeTicket(ticket)),
                    new SecondaryButtonBuilder()
                        .setLabel("Rename")
                        .setCustomId(renameTicket(ticket)),
                ),
            ],
        });
    }
}
