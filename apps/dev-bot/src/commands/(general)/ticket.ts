import { randomBytes } from "node:crypto";
import {
    ActionRowBuilder,
    ChatInputCommandBuilder,
    DangerButtonBuilder,
} from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { closeTicket } from "../../buttons/close-ticket.ts";

export default class TicketCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ticket")
                .setDescription("Open a ticket with a Close button.")
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
        // Handlers stay stateless: the ticket's identity travels in the button.
        const ticketId = randomBytes(4).toString("hex");

        await ctx.interaction.reply({
            content: `Ticket ${ticketId}: ${subject}`,
            allowedMentions: { parse: [] },
            components: [
                new ActionRowBuilder().addComponents(
                    new DangerButtonBuilder().setLabel("Close").setCustomId(
                        closeTicket({
                            ticketId,
                            owner: ctx.interaction.user.id,
                        }),
                    ),
                ),
            ],
        });
    }
}
