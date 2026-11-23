# Autocomplete

Autocomplete shows dynamic suggestions while a user types an option value. In Hyperion, autocomplete is an optional `autocomplete()` method on your command definition. You do not need a separate folder or handler file.

## Adding suggestions

Enable autocomplete on an option in your command builder, then add an `autocomplete()` method to `defineCommand()`:

```ts
// src/commands/topic.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";

const topics = ["commands", "buttons", "select-menus", "modals"];

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("topic")
        .setDescription("Explore a topic.")
        .addStringOptions(option =>
            option
                .setName("query")
                .setDescription("Search for a topic")
                .setRequired(true)
                .setAutocomplete(true),
        ),
    autocomplete: async ctx => {
        const focused = ctx.interaction.options.getFocused();

        await ctx.interaction.respond(
            topics
                .filter(topic => topic.includes(focused.value.toLowerCase()))
                .slice(0, 25)
                .map(topic => ({ name: topic, value: topic })),
        );
    },
    run: async ctx => {
        const query = ctx.interaction.options.getString("query", true);

        await ctx.interaction.reply(
            topics.includes(query)
                ? `Selected: ${query}.`
                : "Choose an available topic.",
        );
    },
});
```

One `autocomplete()` method handles every autocomplete option on that command. If a command has multiple autocomplete options, inspect `ctx.interaction.options.getFocused(true).name` to branch on the active option. Responding works the same way as in plain discord.js. See the discord.js guide on [autocomplete](https://discordjs.guide/legacy/slash-commands/autocomplete).

## Validating the submitted value

Discord lets users ignore autocomplete suggestions and submit arbitrary text. Always validate the option value inside `run()`, as shown in the example above, or with [typed input](input.md). Selecting a suggestion only fills in the input field; running the command triggers a separate interaction.

## Guards and autocomplete

Command [guards](guards.md) do not run for autocomplete interactions. Discord sends an autocomplete interaction on every keystroke, which would repeatedly trigger guards such as cooldowns. If your suggestions expose private data, check permissions inside `autocomplete()` before responding.

## Error handling

If `autocomplete()` throws, finishes without calling `respond()`, or is missing from the command, Hyperion replies with an empty list of choices so the Discord client does not hang. Hyperion can only send that fallback after `autocomplete()` returns, so always `await` asynchronous work inside it.
