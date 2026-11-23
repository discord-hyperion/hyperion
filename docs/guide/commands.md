# Commands

Slash commands (also called chat-input commands), subcommands, and context-menu commands live in `src/commands/`. Hyperion discovers each file in that folder, builds the command tree, and deploys it to Discord at startup.

## Basic command structure

Define a standalone slash command with `defineCommand()`, passing a builder and a `run()` function:

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

Every command file must default-export the result of its `define*()` function (`export default defineCommand(...)`). Hyperion ignores named exports and fails startup if a file has no valid default export.

> [!TIP]
> To validate and type command options with a schema instead of calling `getString()`, see [Typed input](input.md).

## Folder convention

Folder names under `src/commands/` control command organization and subcommand nesting:

| Folder   | Role                                 | Name source        | `index.ts`                           |
| -------- | ------------------------------------ | ------------------ | ------------------------------------ |
| `(name)` | Command category (organization only) | Ignored by Discord | Ignored barrel                       |
| `[name]` | Parent command                       | Folder name        | Required (`defineParentCommand()`)   |
| `{name}` | Subcommand group inside a parent     | Folder name        | Required (`defineSubcommandGroup()`) |

```text
src/commands/
├── (general)/
│   └── ping.ts                 ─▶ /ping
└── [ticket]/
    ├── index.ts                ─▶ parent definition (parent guards)
    ├── close.ts                ─▶ /ticket close
    └── {settings}/
        ├── index.ts            ─▶ group definition (group guards)
        └── view.ts             ─▶ /ticket settings view
```

Standalone commands and subcommands take their Discord name from `.setName()` on the builder; their filenames are only for organization. Parent commands and subcommand groups take their name from the `[parent]` or `{group}` folder; if you call `.setName()` on a parent or group builder, it must match the folder name or loading fails. Command categories do not affect command names, so you can reorganize files across categories without changing registered commands.

## Subcommands

To create subcommands, add a `[parent]` folder with an `index.ts` parent definition and one file per subcommand. You can nest `{group}` folders one level deeper inside a parent folder.

The parent definition holds top-level metadata, contexts, permissions, and shared guards, and has no `run()` function. Define it with `defineParentCommand()`:

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

Each leaf file inside `[ticket]/` defines one subcommand with `defineSubcommand()` and a `ChatInputCommandSubcommandBuilder`:

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

Files inside a `[parent]` folder must use `defineSubcommand()` rather than `defineCommand()`, standalone command files cannot use `defineSubcommand()`, and every `[parent]` or `{group}` folder must contain at least one subcommand or startup fails.

> [!CAUTION]
> Hyperion attaches discovered subcommands to the parent builder during loading. Do not call `addSubcommands()` or add options on the parent builder yourself, or loading will fail.

### Subcommand groups

Add a `{group}/index.ts` group definition using `defineSubcommandGroup()`, then place subcommand files beside it:

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

### Guards

[Guards](guards.md) inherit from the outermost definition inward. For `/ticket settings view`, execution flows in this order:

```text
parent guards ─▶ group guards ─▶ view guards ─▶ run()
```

If any guard returns `false`, execution stops immediately and no later guards or `run()` execute.

> [!NOTE]
> Autocomplete interactions skip parent, group, and subcommand guards. Check permissions inside [`autocomplete()`](autocomplete.md) whenever suggestions include private data.

## Context menus

Context-menu commands appear in Discord's right-click `Apps` menu on users or messages. Define them with `defineCommand()` and either `UserContextCommandBuilder` or `MessageContextCommandBuilder`—Hyperion infers the command type from the builder with no extra `type` option:

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

Place context-menu files directly in `src/commands/` or inside a `(category)` folder, never inside a `[parent]` folder. A context-menu command can share a name with a slash command because Discord separates them by command type. Context-menu commands have no command options and do not accept `input` or `autocomplete`.

## Deploying

Pass the `commands` option to `HyperionClient.create()` to load `src/commands/` and deploy at startup:
- With `guildIds`, commands deploy to each listed server immediately.
- Without `guildIds`, commands deploy globally.

Omitting `commands` skips loading and deploying `src/commands/`. Hyperion compares your local definitions against Discord's registered commands and skips any scope with no changes; when commands change, it logs which commands were added, removed, or updated. If `src/commands/` is missing or empty, Hyperion skips deployment at startup so existing commands on Discord are not wiped.

> [!CAUTION]
> Deploying overwrites every command in the target scope, including commands registered outside Hyperion.

If deployment fails partway through a list of guilds, guilds that already succeeded keep their updated commands.

## Finding a command in code

`client.commands` holds every loaded command and subcommand:

```ts fragment
client.commands.resolve("ping");
client.commands.resolve("Inspect", ApplicationCommandType.User);
client.commands.resolveSubcommand("ticket", "close");
// Argument order is (parent, subcommand, group).
client.commands.resolveSubcommand("ticket", "view", "settings");
```
