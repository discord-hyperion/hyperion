import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand, ownerOnly } from "@hyperion/core";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("ping")
        .setDescription("Check whether the bot is responding."),
    guards: [ownerOnly],
    run: async ctx => {
        await ctx.interaction.reply("Pong!");
    },
});
