import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("ping")
        .setDescription("Check whether the bot is responding."),
    async run(ctx) {
        await ctx.interaction.reply("Pong from /tools ping!");
    },
});
