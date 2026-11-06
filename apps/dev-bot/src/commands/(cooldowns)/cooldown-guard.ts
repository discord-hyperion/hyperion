import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, cooldown } from "@hyperion/core";
import { Collection } from "discord.js";

// In memory: a restart forgets every cooldown. Compare /cooldown-sqlite.
const cooldowns = new Collection<string, number>();

export default class extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("cooldown-guard")
                .setDescription(
                    "Try a 10-second cooldown from the built-in guard.",
                ),
            guards: [
                ctx =>
                    cooldown({
                        key: ctx.interaction.user.id,
                        durationMs: 10_000,
                        entries: cooldowns,
                    }),
            ],
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply(
            "Done. Run it again within 10 seconds and the guard stops you.",
        );
    }
}
