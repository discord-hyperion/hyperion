import { UserContextCommandBuilder } from "@discordjs/builders";
import { defineCommand, ownerOnly } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new UserContextCommandBuilder().setName("Inspect"),
    guards: [ownerOnly],
    async run(ctx) {
        const user = ctx.interaction.targetUser;

        await ctx.interaction.reply({
            content: `User: ${user.username} (${user.id}).`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
