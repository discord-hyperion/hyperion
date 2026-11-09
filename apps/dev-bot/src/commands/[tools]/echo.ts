import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("echo")
        .setDescription("Repeat a message privately.")
        .addStringOptions(option =>
            option
                .setName("text")
                .setDescription("Text to repeat")
                .setRequired(true)
                .setMaxLength(200)
                .setAutocomplete(true),
        ),
    autocomplete: async ctx => {
        const focused = ctx.interaction.options.getFocused();

        if (focused.name !== "text") return;

        await ctx.interaction.respond(
            ["Hello!", "Welcome!", "Thanks for trying Hyperion!"]
                .filter(text =>
                    text
                        .toLowerCase()
                        .includes(String(focused.value).toLowerCase()),
                )
                .map(text => ({ name: text, value: text })),
        );
    },
    run: async ctx => {
        await ctx.interaction.reply({
            content: ctx.interaction.options.getString("text", true),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
