# Context-menu commands

For user and message command terminology, see the [command glossary](GLOSSARY.md#commands).
Define context-menu handlers with the same `defineCommand()`,
`<root>/src/commands` discovery, `client.commands` registry, deployment scope,
guards, logging, and execution-error handling as slash commands.

`defineCommand()` infers the command type from the builder:
`UserContextCommandBuilder` makes a user command and
`MessageContextCommandBuilder` a message command, and the context, guards, and
returned `Command<Type>` are typed to match. There is no separate `type` option
and no type argument. Context menus reject `input` and `autocomplete` as type
errors. `Command` and `CommandContext` still default to chat-input commands
where code names them. Hyperion refines the pinned SDK's broad context-menu
`toJSON()` declarations through declaration merging to reflect the distinct
command types those builders always serialize. This adds no runtime wrappers or
duplicate configuration.

## User commands

```ts
import { UserContextCommandBuilder } from "@discordjs/builders";
import { defineCommand, ownerOnly } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new UserContextCommandBuilder().setName("Inspect"),
    guards: [ownerOnly],
    run: async ctx => {
        const user = ctx.interaction.targetUser;

        await ctx.interaction.reply({
            content: `User: ${user.username} (${user.id}).`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
```

The context exposes `UserContextMenuCommandInteraction`, including `targetUser`
and `targetMember`. Member data depends on guild context and cache state, so it
can be null or an API member rather than a cached guild member. Use
`inCachedGuild()` before relying on cached-member methods. Guards authorize the
invoking `interaction.user`, not the selected `targetUser`.

## Message commands

```ts
import { MessageContextCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

export default defineCommand({
    builder: new MessageContextCommandBuilder().setName("Inspect"),
    run: async ctx => {
        const message = ctx.interaction.targetMessage;

        await ctx.interaction.reply({
            content: `Message: ${message.id}. Author: ${message.author.username}.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
});
```

The context exposes `MessageContextMenuCommandInteraction.targetMessage`.

The installed v15 builders are `UserContextCommandBuilder` and
`MessageContextCommandBuilder`. `ContextMenuCommandBuilder` itself is abstract.
Context menus do not take slash-command descriptions, options, or autocomplete;
builders and Discord validate their payloads. A configured `autocomplete()` hook
on a context-menu definition is rejected during discovery.

## Registry and deployment

Names are unique per application-command type, not across all types. A slash
command, user command, and message command may share a name. Context-menu names
preserve capitalization and spaces. Dispatch matches both name and type; a
same-named command of another type is never a fallback.

Use typed lookup when retrieving a definition:

```ts fragment
const slash = client.commands.resolve("ping");
const userMenu = client.commands.resolve(
    "Inspect",
    ApplicationCommandType.User,
);
const messageMenu = client.commands.resolve(
    "Inspect",
    ApplicationCommandType.Message,
);
```

`resolve()` defaults to chat-input commands and narrows its return type. The
registry remains a Discord `Collection` of `AnyCommand`: `get()` returns a union,
which can be narrowed using `command.commandType`. Slash commands retain their
plain-name keys, so `get("ping")` and `has("ping")` still work. Context-menu keys
include the numeric command type; `CommandRegistry.key(name, type)` produces
these keys for manual insertion or deletion without replacing Collection APIs.

```ts fragment
client.commands.set(
    CommandRegistry.key("Inspect", ApplicationCommandType.User),
    userCommand,
);
```

Import `CommandRegistry` from the public framework entry point if inserting
handlers manually. Filesystem discovery handles keys automatically and stages
all three types before replacing the registry, so duplicate names within one
type or invalid definitions preserve previously loaded handlers.

Bulk registration sends all command types together in each configured scope.
Context-menu-only bots are supported; an empty combined registry still cannot
clear deployed commands. Guild IDs select guild registration and omitting them
selects global registration. Builder errors and indexed Discord validation
errors retain source-file context, including when names are shared across types.

## Execution and guards

Use `Guard<CommandContext<ApplicationCommandType.User>>` or the corresponding
message context for target-specific checks. Shared `InteractionContext` guards
such as `ownerOnly` and `cooldown()` also work. Factories are lazy and receive the
resolved target only during invocation, never during discovery or deployment.

Handlers own acknowledgment: reply immediately, defer and later edit the reply,
or open a modal before acknowledging. Missing handlers receive a private
unavailable response. Guard or handler errors use the normal command pipeline:
new interactions get an ephemeral reply, deferred replies are edited, and
already-replied interactions receive ephemeral follow-ups. Error-delivery
failures are logged and contained.

Invocation logs use the existing `command.*` events and include `command`,
`commandType`, `interactionId`, `guildId`, and `userId`. Framework logs do not
include selected-user data, target messages, or message contents. Keep private
target data out of application log messages and errors too. Handler instances
remain shared and stateless.
