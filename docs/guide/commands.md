# Commands

Commands live in `src/commands`. A plain file is a slash command, and the folder
names around it decide whether it's grouped under a parent. You never register
anything by hand.

## Slash commands

You've already seen one in [getting started](getting-started.md):
`defineCommand()` with a builder and a `run()` function. The builder is the source of truth for the
name, description, and options:

```ts fragment
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

Want the options validated and typed for you? See [typed input](input.md).

## Organising with folders

Three folder styles cover everything:

| Folder   | What it means                        | Example                                                 |
| -------- | ------------------------------------ | ------------------------------------------------------- |
| `(name)` | A category, just for tidiness        | `(general)/ping.ts` → `/ping`                           |
| `[name]` | A parent command                     | `[ticket]/close.ts` → `/ticket close`                   |
| `{name}` | A subcommand group (inside a parent) | `[ticket]/{settings}/view.ts` → `/ticket settings view` |

```text
src/commands/
├── (general)/
│   └── ping.ts                 → /ping
└── [ticket]/
    ├── index.ts                → the /ticket parent
    ├── close.ts                → /ticket close
    └── {settings}/
        ├── index.ts            → the "settings" group
        └── view.ts             → /ticket settings view
```

Categories never change a command's name, so move files between them freely.

## Subcommands

A parent needs an `index.ts` that describes the top-level command. It holds the
description and anything that applies to the whole command, like contexts or
shared guards, but it doesn't run anything itself:

```ts
// src/commands/[ticket]/index.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion/core";
import { InteractionContextType } from "discord.js";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setDescription("Manage support tickets.")
        .setContexts(InteractionContextType.Guild),
});
```

The folder already says `ticket`, so you don't need `setName()`. Each file next
to it defines a subcommand with a subcommand builder:

```ts
// src/commands/[ticket]/close.ts
import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";

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

Hyperion stitches the subcommands into the parent when it deploys. Don't add
subcommands to the parent's builder yourself; it'll refuse to load.

## Subcommand groups

Groups work the same way one level down. Add `{settings}/index.ts` with a
group definition, then put subcommand files beside it:

```ts
// src/commands/[ticket]/{settings}/index.ts
import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { defineSubcommandGroup } from "@hyperion/core";

export default defineSubcommandGroup({
    builder: new ChatInputCommandSubcommandGroupBuilder().setDescription(
        "Configure ticket routing",
    ),
});
```

Guards stack from the outside in: parent guards run first, then the group's,
then the subcommand's.

## Context menus

User and message commands use `defineCommand()` too. The builder decides the
command type, so `ctx.interaction` is typed for it:

```ts
import { UserContextCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { MessageFlags } from "discord.js";

// A MessageContextCommandBuilder makes a message command instead.
export default defineCommand({
    builder: new UserContextCommandBuilder().setName("Inspect"),
    run: async ctx => {
        await ctx.interaction.reply({
            content: `That's ${ctx.interaction.targetUser.username}.`,
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

Put context menus in `src/commands` or a category, but not inside a parent
folder. One can share its name with a slash command.

## Deploying

Commands deploy when the client is created, if you passed `commands` options:
- With `guildIds`, each listed server gets your commands immediately.
- Without it, they deploy globally.

Hyperion checks what Discord already has first, and skips a scope when nothing
changed, so restarting is cheap. When something did change, the log lists which
commands were added, removed, or changed.

Deploying overwrites every command in that scope, so anything registered outside
Hyperion disappears. If your command folder is empty, Hyperion skips deploying
rather than wiping everything. And if one server fails partway through a
multi-server deploy, the servers that already succeeded keep the new commands.

## Finding a command in code

`client.commands` holds every loaded command:

```ts fragment
client.commands.resolve("ping");
client.commands.resolveSubcommand("ticket", "close");
client.commands.resolveSubcommand("ticket", "view", "settings");
```
