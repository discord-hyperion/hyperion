# Autocomplete

Autocomplete shows suggestions while someone types an option value. In
Hyperion, it's just another method on your command: no extra folder, nothing to
register.

## Adding suggestions

Turn on autocomplete for the option, then add an `autocomplete()` method:

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    type AutocompleteContext,
    Command,
    type CommandContext,
} from "@hyperion/core";

const topics = ["commands", "buttons", "select-menus", "modals"];

export default class TopicCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("topic")
                .setDescription("Explore a topic")
                .addStringOptions(option =>
                    option
                        .setName("query")
                        .setDescription("Search for a topic")
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        });
    }

    async autocomplete(ctx: AutocompleteContext) {
        const focused = ctx.interaction.options.getFocused();

        await ctx.interaction.respond(
            topics
                .filter(topic => topic.includes(focused.value.toLowerCase()))
                .slice(0, 25)
                .map(topic => ({ name: topic, value: topic })),
        );
    }

    async run(ctx: CommandContext) {
        const query = ctx.interaction.options.getString("query", true);
        await ctx.interaction.reply(
            topics.includes(query)
                ? `Selected: ${query}.`
                : "Choose an available topic.",
        );
    }
}
```

`getFocused()` tells you which option the user is typing in (`focused.name`) and
what they've typed so far (`focused.value`). If several options autocomplete,
switch on the name.

## Rules from Discord

- Respond with `respond(choices)`, not `reply()`. You can't defer.
- At most 25 choices, and you have three seconds.
- An option can have fixed choices or autocomplete, not both.

So keep lookups fast: cache what you can and trim the list yourself.

## Suggestions aren't validation

Users can ignore your suggestions and type anything, so `run()` still has to
check the value (the example above does). Picking a suggestion only fills in the
option; running the command is a separate interaction.

## Guards don't run here

Your command's [guards](guards.md) don't run for autocomplete. Running them on
every keystroke would burn through cooldowns. If suggestions reveal anything
private, check who's asking inside `autocomplete()` itself.

## If something goes wrong

If your method throws, finishes without responding, or the command has no
`autocomplete()` method, Hyperion sends an empty list so the user's client
doesn't hang. A method that hangs past Discord's deadline can't be rescued,
though, so always `await` your work.
