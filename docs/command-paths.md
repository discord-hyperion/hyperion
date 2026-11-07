# Command path conventions

Command modules live under `<bot root>/src/commands`. Terms are defined in the
[command glossary](GLOSSARY.md#commands); their folder notation is:

| Folder       | Meaning           |
| ------------ | ----------------- |
| `(category)` | Command category. |
| `[parent]`   | Parent command.   |
| `{group}`    | Subcommand group. |

```text
src/commands/
├── (general)/
│   └── ping.ts                         → /ping
└── (support)/
    └── [ticket]/
        ├── index.ts                    → parent metadata and guards
        ├── create.ts                   → /ticket create
        ├── close.ts                    → /ticket close
        └── {settings}/
            ├── index.ts                → group metadata and guards
            └── view.ts                 → /ticket settings view
```

These examples assume builder names match module filenames. Builders remain the
source of executable command names, descriptions, and options. Parsing reports
the filename stem as `moduleName`, plus category names, `parent`, and `group`
metadata. It does not import modules, inspect builders, or generate descriptions.

Category folders can appear at any depth. A group requires a parent, and parents
and groups cannot nest within another of the same kind. Folder delimiters must
match and names must not be empty. Legacy unmarked folders remain organizational
for compatibility. The parser expects relative module paths and rejects traversal,
unsupported extensions, declarations, and test modules. Supported extensions
include `.tsx` and `.jsx`; these preserve parent/group index rules and module-name
extraction. Configure the JSX compiler as described in [JSX authoring](jsx.md). Both slash styles are
supported. A direct `[parent]/index.ts` (or supported JS/TS equivalent) is a parent
definition. A direct `{group}/index.ts` is a group definition; other index files
remain ignored barrels.

## Defining parents

Every logical parent has exactly one definition, even when categories split its
leaves across multiple folders. Put this in `(support)/[ticket]/index.ts`:

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand, ownerOnly } from "@hyperion/core";
import { InteractionContextType } from "discord.js";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setDescription("Manage support tickets.")
        .setContexts(InteractionContextType.Guild),
    guards: [ownerOnly],
});
```

The folder supplies `ticket`; an explicit builder name must match it. Parent
builders provide descriptions, localizations, contexts, permissions, integration
types, and other top-level metadata. They do not implement `run()`.
Manually adding subcommands, groups, or ordinary options to a parent builder raises
a runtime error during construction/loading. Discovered leaf files supply the children.
Missing, duplicate, and empty parent definitions fail loading.

## Defining subcommands

Each leaf extends `Subcommand` with a native `ChatInputCommandSubcommandBuilder`.
For example, put this in `(support)/[ticket]/close.ts`:

```ts
import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("close")
        .setDescription("Close a ticket.")
        .addStringOptions(option =>
            option.setName("id").setDescription("Ticket ID").setRequired(true),
        ),
    async run(ctx) {
        await ctx.interaction.reply({
            content: `Selected ticket: ${ctx.interaction.options.getString("id", true)}`,
            allowedMentions: { parse: [] },
        });
    },
});
```

This defines `/ticket close id:123`. Hyperion combines siblings into the parent's
top-level registration, retaining native leaf descriptions, localizations, and options.
Parent guards execute first, followed by the selected leaf's guards and `run()`.
Rejection or error stops execution before later factories or handlers run.
The selected leaf's optional `autocomplete()` hook bypasses both guard levels and
retains the standard empty-choice fallback.
Invocation logs include the parent name and selected subcommand, without option values.

Subcommands are stored under `CommandRegistry.subcommandKey("ticket", "close")`.
Use `client.commands.resolveSubcommand("ticket", "close")` for typed lookup.
Use `client.commands.parents.get("ticket")` for the non-executable parent definition.
Regular commands retain their existing keys and `resolve(name)` behavior.

Duplicate sibling names, standalone chat-input commands sharing a parent's name,
context-menu commands inside parents, and nested command options are rejected.
Failures preserve the previously loaded registry. Context menus may still share a
parent's name because their command type differs.

Top-level-only settings belong to `ParentCommand`; the native subcommand builder
does not expose those methods. A `defineCommand()` handler inside `[parent]` and a
standalone `defineSubcommand()` handler are rejected rather than converted
implicitly.
Failed loads preserve both the executable-handler and parent-definition collections.
SDK validation checks the complete composed parent before REST, including the
subcommand count. Temporary builder children are removed even after failure, so
repeated registration does not accumulate options. Deployment errors retain parent
and leaf source files.

Groups use explicit definitions and the same executable `Subcommand` leaves.
See [subcommand groups](subcommand-groups.md) for configuration, lookup, validation,
and guard inheritance.
