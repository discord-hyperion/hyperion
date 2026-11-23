# Autocomplete

Autocomplete returns dynamic suggestions while a user types a slash-command option. In Hyperion, define an optional `autocomplete()` method directly on `defineCommand()` or `defineSubcommand()` with no separate folder or handler file.

## Adding suggestions

Enable autocomplete on an option in your command builder, then add `autocomplete()` to the command definition:

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

One `autocomplete()` method handles every autocomplete option on that command. When a command has multiple autocomplete options, inspect `ctx.interaction.options.getFocused().name` to branch on the active option. Responding works the same way as in plain discord.js; see the discord.js guide on [autocomplete](https://discordjs.guide/legacy/slash-commands/autocomplete).

`defineSubcommand()` supports `autocomplete()` in the same way, routing directly to the leaf subcommand. Context-menu commands do not support `autocomplete()`. While a user is typing, other command options (even required ones) may be absent or incomplete, and integer or number options expect numeric `value`s in `respond()`.

## Validating the submitted value

Discord lets users ignore autocomplete suggestions and submit arbitrary text. Always validate the final option value inside `run()`, as shown above, or with [typed input](input.md). Selecting a suggestion only fills in the option; running the command sends a separate interaction.

## Guards and autocomplete

Discord sends an autocomplete interaction on every keystroke, so Hyperion skips [guards](guards.md) (including parent and group guards on subcommands) to avoid repeatedly triggering checks such as cooldowns. See the [interaction pipeline](how-hyperion-works.md#interaction-pipeline).

> [!WARNING]
> Because autocomplete skips all command, parent, and group guards, check permissions inside `autocomplete()` before returning suggestions derived from private data.

## Error handling

If `autocomplete()` throws, returns without calling `respond()`, or is omitted from the command, Hyperion replies with an empty list of choices so the Discord client does not hang. Always `await` asynchronous work inside `autocomplete()` so Hyperion does not send the fallback before your response finishes. Hyperion does not truncate choices (cap the list at 25 yourself) or cancel slow or stale lookups.
