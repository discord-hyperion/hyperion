import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";
import { cooldowns } from "../../database.ts";

const durationMs = 10_000;

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("sqlite")
        .setDescription(
            "Try a 10-second cooldown stored in SQLite, which survives restarts.",
        ),
    async run(ctx) {
        const { user } = ctx.interaction;
        const until = cooldowns.get(user.id);

        if (until !== undefined) {
            await ctx.interaction.reply({
                // Discord renders <t:seconds:R> as relative time, such as "in 8 seconds".
                content: `Slow down! Try again <t:${Math.ceil(until / 1000)}:R>.`,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        cooldowns.set(user.id, Date.now() + durationMs, { ttl: durationMs });

        await ctx.interaction.reply(
            "Done. Run it again within 10 seconds and SQLite remembers.",
        );
    },
});
