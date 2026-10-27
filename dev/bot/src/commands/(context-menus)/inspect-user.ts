import { UserContextCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, OwnerOnly } from "@hyperion";
import { type ApplicationCommandType, MessageFlags } from "discord.js";

export default class InspectUser extends Command<ApplicationCommandType.User> {
    constructor() {
        super({
            builder: new UserContextCommandBuilder().setName("Inspect"),
            guards: [new OwnerOnly()],
        });
    }

    async run(ctx: CommandContext<ApplicationCommandType.User>) {
        const user = ctx.interaction.targetUser;

        await ctx.interaction.reply({
            content: `User: ${user.username} (${user.id}).`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
