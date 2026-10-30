# Subcommand groups

Groups extend the folder conventions in [command paths](command-paths.md).
Terms are defined in the [glossary](GLOSSARY.md#commands).

## Define a group

Every group requires an explicit definition at `[parent]/{group}/index.ts`.
The module default-exports a `SubcommandGroup` subclass with a native
`ChatInputCommandSubcommandGroupBuilder`, a meaningful description, optional
localizations, and optional shared guards. It has no `run()` method.

```ts
import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { SubcommandGroup } from "@hyperion/core";

export default class Settings extends SubcommandGroup {
    constructor() {
        super({
            builder:
                new ChatInputCommandSubcommandGroupBuilder().setDescription(
                    "Configure ticket routing and notifications",
                ),
        });
    }
}
```

The folder supplies the default group name. Group metadata is explicit rather
than generated from folder names. Top-level permissions, contexts, and
installation settings remain on the parent command.
The development bot demonstrates `/tools diagnostics uptime` alongside the
direct `/tools ping` and `/tools echo` subcommands.

Grouped leaves reuse the existing `Subcommand` class, native leaf builder,
`run()`, and optional `autocomplete()` hook. Their filesystem ancestry determines
whether they are direct or grouped subcommands.

```text
[ticket]/
├── index.ts                 ParentCommand
├── close.ts                 Subcommand: /ticket close
└── {settings}/
    ├── index.ts             SubcommandGroup
    ├── view.ts              Subcommand: /ticket settings view
    └── update.ts            Subcommand: /ticket settings update
```

## Guards and autocomplete

Execution runs parent guards, then group guards, then leaf guards. Each level
preserves array order and lazy per-invocation factories. Rejection or error stops
later guards, factories, and the handler.

Autocomplete invokes only the selected leaf's hook and bypasses all three guard
levels. Existing empty-choice fallback and response handling remain unchanged;
hooks must authorize private suggestions themselves.

## Logical identity and lookup

Groups are identified by parent and group name. Matching pairs combine across
category folders, with exactly one definition for each logical group. Different
parents may reuse group names. Categories contribute nothing to routing keys.

Existing direct-leaf lookup and keys remain unchanged. Grouped lookup adds an
optional final group argument, with executable keys in invocation order:

```ts
client.commands.resolveSubcommand("ticket", "close");
client.commands.resolveSubcommand("ticket", "view", "settings");
client.commands.resolveGroup("ticket", "settings");
```

The grouped executable key is `"ticket settings view"`, produced by
`CommandRegistry.subcommandKey("ticket", "view", "settings")`.
`resolveGroup()` returns the non-executable group definition. Definitions are
also available in `client.commands.groups`, keyed by
`CommandRegistry.groupKey("ticket", "settings")`. The existing general lookup
also supports `resolve("ticket", ApplicationCommandType.ChatInput, "view", "settings")`.

## Structure and validation

A parent may contain both direct subcommands and groups.
Missing, duplicate, or empty group definitions fail loading. Any explicit group
builder name must match its folder name. Manually added children are rejected;
discovered leaf modules supply the group's subcommands.

Leaf names must be unique within their group. Different groups, and direct leaves
under the parent, may reuse the same leaf name. A direct leaf and a group cannot
share a name under one parent. Nested groups and context-menu commands inside
groups remain invalid.

## Composition and failures

Stage group definitions alongside parents and executable handlers. Replace the
live collections only after the entire load succeeds; failed reloads preserve
all previously loaded definitions and handlers.

Compose groups using fresh native builders so stored definitions do not accumulate
children across registration attempts. Validate the complete composed parent
before REST, including its direct leaves, groups, and grouped leaves. Preserve
original failures and relevant parent, group, and leaf source paths in errors.

Atomic local loading does not make multi-guild deployment transactional. An earlier
successful Discord registration cannot automatically be rolled back when a later
request fails.
