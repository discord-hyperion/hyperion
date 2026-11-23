# Commands

Slash commands, also called chat-input commands, live in `src/commands/`. Hyperion loads each file in that folder and deploys the resulting commands to Discord.

## Basic command structure

Define a slash command with `defineCommand()`, passing a builder and a `run()` function. This example creates an `/echo` command that repeats a required string option:

```ts
// src/commands/echo.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("echo")
        .setDescription("Repeat a message.")
        .addStringOptions(option =>
            option
                .setName("text")
                .setDescription("What to say")
                .setRequired(true),
        ),
    run: async ctx => {
        await ctx.interaction.reply({
            content: ctx.interaction.options.getString("text", true),
            allowedMentions: { parse: [] },
        });
    },
});
```

> [!IMPORTANT]
> Command files must use `export default defineCommand(...)`. Hyperion ignores named exports and fails to load files without a default export.

> [!TIP]
> To validate and type command options with a schema instead of calling `getString()`, see [Typed input](input.md).

## Folder convention

Folder names under `src/commands/` determine how commands are grouped:

| Folder   | Meaning                          | Example file                  | Command                 |
| -------- | -------------------------------- | ----------------------------- | ----------------------- |
| `(name)` | Category folder for organization | `(general)/ping.ts`           | `/ping`                 |
| `[name]` | Parent command                   | `[ticket]/close.ts`           | `/ticket close`         |
| `{name}` | Subcommand group inside a parent | `[ticket]/{settings}/view.ts` | `/ticket settings view` |

```text
src/commands/
├── (general)/
│   └── ping.ts                 -> /ping
└── [ticket]/
    ├── index.ts                -> /ticket parent definition
    ├── close.ts                -> /ticket close
    └── {settings}/
        ├── index.ts            -> "settings" group definition
        └── view.ts             -> /ticket settings view
```

Category folders do not affect the command name, so you can reorganize files across categories without changing how commands are registered.

## Subcommands

To create subcommands, add a `[parent]` folder containing an `index.ts` parent definition and one file per subcommand. You can also nest `{group}` folders inside a parent folder.

The parent `index.ts` holds the top-level description, contexts, permissions, and shared guards. It has no `run()` function. Define it with `defineParentCommand()`:

```ts
// src/commands/[ticket]/index.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion-js/core";
import { InteractionContextType } from "discord.js";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setDescription("Manage support tickets.")
        .setContexts(InteractionContextType.Guild),
});
```

Hyperion takes the parent command name from the `[ticket]` folder, so you do not need to call `setName()` on the parent builder.

Each file beside `index.ts` defines one subcommand using `defineSubcommand()` and a `ChatInputCommandSubcommandBuilder`. Set the subcommand's name on its builder:

```ts
// src/commands/[ticket]/close.ts
import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("close")
        .setDescription("Close a ticket.")
        .addStringOptions(option =>
            option.setName("id").setDescription("Ticket ID").setRequired(true),
        ),
    run: async ctx => {
        await ctx.interaction.reply(
            `Closing ${ctx.interaction.options.getString("id", true)}.`,
        );
    },
});
```

> [!CAUTION]
> Hyperion attaches discovered subcommands to the parent builder during deployment. Do not call `addSubcommands()` on the parent builder yourself, or loading will fail.

### Subcommand groups

Subcommand groups follow the same pattern one level deeper. Add a `{group}/index.ts` file using `defineSubcommandGroup()`, then place subcommand files next to it:

```ts
// src/commands/[ticket]/{settings}/index.ts
import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { defineSubcommandGroup } from "@hyperion-js/core";

export default defineSubcommandGroup({
    builder: new ChatInputCommandSubcommandGroupBuilder().setDescription(
        "Configure ticket routing.",
    ),
});
```

Like parents, subcommand groups take their name from the `{settings}` folder.

### Guards

[Guards](guards.md) run from the outermost level inward. Each bracket below shows which subcommands inherit that level's guards:

```text
/ticket                 parent guards ┐
├── close                             │
└── settings     group guards ┐       │
    └── view                  ┘       ┘
```

For `/ticket settings view`, Hyperion runs the parent's guards first, then the group's guards, then `view`'s guards, and finally `run()`. If any guard rejects, execution stops immediately.

> [!NOTE]
> Autocomplete interactions skip guards. If your autocomplete suggestions contain private data, check permissions inside [`autocomplete()`](autocomplete.md).

## Context menus

Define user and message context-menu commands with `defineCommand()` and either `UserContextCommandBuilder` or `MessageContextCommandBuilder`:

```ts
// src/commands/inspect-user.ts
import { UserContextCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

// Use MessageContextCommandBuilder for a message context menu.
export default defineCommand({
    builder: new UserContextCommandBuilder().setName("Inspect"),
    run: async ctx => {
        await ctx.interaction.reply({
            content: `User: ${ctx.interaction.targetUser.username}`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

Place context-menu files directly in `src/commands/` or inside a `(category)` folder, never inside a `[parent]` folder. A context menu can share a name with a slash command because Discord treats them as separate command types.

## Deploying

When you pass the `commands` option to `HyperionClient.create()`, Hyperion deploys your commands during startup:
- With `guildIds`, commands deploy to each listed server immediately.
- Without `guildIds`, commands deploy globally.

Hyperion compares your local commands against what Discord currently has registered and skips a scope if nothing changed. When commands do change, Hyperion logs which commands were added, removed, or updated.

> [!WARNING]
> Deploying overwrites every command in the target scope, including commands registered outside Hyperion. If `src/commands/` is empty, Hyperion refuses to deploy so it does not wipe your existing commands.

If deployment fails partway through a list of guilds, guilds that already succeeded keep the updated commands.

## Finding a command in code

`client.commands` stores every loaded command and subcommand:

```ts fragment
client.commands.resolve("ping");
client.commands.resolveSubcommand("ticket", "close");
client.commands.resolveSubcommand("ticket", "view", "settings");
```
