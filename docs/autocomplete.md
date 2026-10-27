# Autocomplete

See the [execution glossary](GLOSSARY.md#execution) for the distinction between
autocomplete, command invocation, and input validation.

Commands can implement an optional `autocomplete(ctx)` method alongside `run()`.
Hyperion routes autocomplete requests by command name using the existing command
registry. There is no separate handler folder or registration step. Enable
autocomplete on each string, integer, or number option that needs suggestions.

## Define a handler

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    type AutocompleteContext,
    Command,
    type CommandContext,
} from "discord-hyperion";
import { MessageFlags } from "discord.js";

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

        if (focused.name !== "query") {
            await ctx.interaction.respond([]);
            return;
        }

        await ctx.interaction.respond(
            topics
                .filter(topic => topic.includes(focused.value.toLowerCase()))
                .slice(0, 25)
                .map(topic => ({ name: topic, value: topic })),
        );
    }

    async run(ctx: CommandContext) {
        const query = ctx.interaction.options.getString("query", true);

        await ctx.interaction.reply({
            content: topics.includes(query)
                ? `Selected topic: ${query}.`
                : "Choose an available topic.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
```

The installed discord.js v15 API returns the focused option object directly
from `getFocused()`, without the older boolean argument. Its `name`, `type`, and
`value` identify which option is being edited and the current input. Commands
with multiple autocomplete-enabled options can switch on `focused.name`;
`getSubcommand()` and `getSubcommandGroup()` are available when needed. Other
options can be incomplete during autocomplete, even when required at submission.

Suggestions contain a display `name` and a submitted `value`. Use numeric values
when responding for integer or number options. Selecting a suggestion fills the
option; submitting the command later invokes `run()` as a separate interaction.
Suggestions are not validation: users can submit other values, so `run()` must
validate the selected value and authorize execution again.

The dev bot includes a `/topic` command that filters public topic names
case-insensitively and validates the submitted identifier in its normal handler.

## Response lifecycle

Autocomplete uses `ctx.interaction.respond(choices)`, not `reply()`,
`deferReply()`, or follow-ups. Discord allows at most 25 choices and requires the
initial response within three seconds; autocomplete cannot be deferred. Static
choices and autocomplete cannot be configured on the same option. See Discord's
[application-command documentation](https://docs.discord.com/developers/interactions/application-commands#autocomplete)
and [interaction response documentation](https://docs.discord.com/developers/interactions/receiving-and-responding).

Hyperion waits for the hook and does not acknowledge before it runs. An empty
choice list is sent when the command or hook is missing, when a hook finishes
without responding, or when a hook throws before responding. Already-responded
requests are not dispatched again, and a failure after responding does not send
a second response. Failed empty-choice responses, including expired requests,
are logged and contained without entering the normal message-error pipeline.

The hook owns its response payload; Hyperion does not truncate or rewrite
choices. Limit the list yourself and keep searches fast with application-owned
caching or bounded lookups. There is no timeout, cancellation, or stale-query
deduplication layer: a hanging hook cannot be rescued by the fallback before
Discord's deadline. Await `respond()` and other work instead of detaching it.

## Guards, context, and logging

Command guards and their factories do not run during autocomplete. Running them
on each keystroke could consume cooldowns or attempt unsupported message replies.
If suggestions expose private data, authorize access in the autocomplete hook
before returning them. A command's execution guard is not a suggestion filter.

`AutocompleteContext` supplies `client`, `interaction`, and `logger`, with the
interaction typed as `AutocompleteInteraction`. `AnyInteraction` includes this
type, while the default `InteractionContext` continues to exclude autocomplete
so existing execution guards and error handlers retain their reply-capable types.

`ctx.logger` carries `command`, `interactionId`, `guildId`, and `userId`.
`autocomplete.started`, `autocomplete.completed`, and `autocomplete.unavailable`
are debug-level events to avoid flooding normal activity logs. Handler failures
emit `autocomplete.failed` with duration; failed fallback responses emit
`autocomplete.response.failed` at error level. Framework logs do not include
focused input, other command arguments, or returned suggestions. Avoid putting
those values in your own log messages or error messages.
