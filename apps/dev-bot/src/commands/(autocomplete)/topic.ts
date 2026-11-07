import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

const topics = [
    {
        name: "Slash commands",
        value: "commands",
        description:
            "Define commands with a chat-input builder and a run method.",
    },
    {
        name: "Buttons",
        value: "buttons",
        description: "Route message buttons by exact custom ID.",
    },
    {
        name: "Select menus",
        value: "select-menus",
        description:
            "Handle string, user, role, mentionable, and channel selections.",
    },
    {
        name: "Modals",
        value: "modals",
        description: "Process submitted form components in a modal handler.",
    },
    {
        name: "Guards",
        value: "guards",
        description: "Run ordered checks before executing handlers.",
    },
    {
        name: "Logging",
        value: "logging",
        description: "Use the scoped context logger for structured logs.",
    },
] as const;

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("topic")
        .setDescription("Explore a Hyperion topic with autocomplete.")
        .addStringOptions(option =>
            option
                .setName("query")
                .setDescription("Search for a topic")
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async autocomplete(ctx) {
        const focused = ctx.interaction.options.getFocused();

        if (focused.name !== "query") {
            await ctx.interaction.respond([]);

            return;
        }

        const query = focused.value.toLowerCase();
        const matches = topics.filter(
            topic =>
                topic.name.toLowerCase().includes(query) ||
                topic.value.includes(query),
        );

        await ctx.interaction.respond(
            matches.slice(0, 25).map(({ name, value }) => ({ name, value })),
        );
    },
    async run(ctx) {
        const query = ctx.interaction.options.getString("query", true);
        const topic = topics.find(topic => topic.value === query);

        await ctx.interaction.reply({
            content: topic
                ? `${topic.name}: ${topic.description}`
                : "That topic is not available. Choose a suggested topic.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
