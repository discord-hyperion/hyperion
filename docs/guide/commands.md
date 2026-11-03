# Commands

Commands live in `src/commands`. A plain file is a slash command, and the folder
names around it decide whether it's grouped under a parent. You never register
anything by hand.

## Slash commands

You've already seen one in [getting started](getting-started.md): a `Command`
with a builder and a `run()` method. The builder is the source of truth for the
name, description, and options:

```ts
export default class EchoCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("echo")
                .setDescription("Repeat a message.")
                .addStringOptions(option =>
                    option
                        .setName("text")
                        .setDescription("What to say")
                        .setRequired(true),
                ),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: ctx.interaction.options.getString("text", true),
            allowedMentions: { parse: [] },
        });
    }
}
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
import { ParentCommand } from "@hyperion/core";
import { InteractionContextType } from "discord.js";

export default class Ticket extends ParentCommand {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setDescription("Manage support tickets.")
                .setContexts(InteractionContextType.Guild),
        });
    }
}
```

The folder already says `ticket`, so you don't need `setName()`. Each file next
to it is a `Subcommand` with a subcommand builder:

```ts
// src/commands/[ticket]/close.ts
import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, Subcommand } from "@hyperion/core";

export default class CloseTicket extends Subcommand {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("close")
                .setDescription("Close a ticket.")
                .addStringOptions(option =>
                    option
                        .setName("id")
                        .setDescription("Ticket ID")
                        .setRequired(true),
                ),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply(
            `Closing ${ctx.interaction.options.getString("id", true)}.`,
        );
    }
}
```

Hyperion stitches the subcommands into the parent when it deploys. Don't add
subcommands to the parent's builder yourself; it'll refuse to load.

## Subcommand groups

Groups work the same way one level down. Add `{settings}/index.ts` with a
`SubcommandGroup`, then put `Subcommand` files beside it:

```ts
// src/commands/[ticket]/{settings}/index.ts
import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { SubcommandGroup } from "@hyperion/core";

export default class Settings extends SubcommandGroup {
    constructor() {
        super({
            builder:
                new ChatInputCommandSubcommandGroupBuilder().setDescription(
                    "Configure ticket routing",
                ),
        });
    }
}
```

Guards stack from the outside in: parent guards run first, then the group's,
then the subcommand's.

## Context menus

User and message commands (the ones under "Apps" when you right-click) are
also `Command`s. Pass the command type as a generic and use the matching builder:

```ts
import { UserContextCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { type ApplicationCommandType, MessageFlags } from "discord.js";

export default class InspectUser extends Command<ApplicationCommandType.User> {
    constructor() {
        super({ builder: new UserContextCommandBuilder().setName("Inspect") });
    }

    async run(ctx: CommandContext<ApplicationCommandType.User>) {
        await ctx.interaction.reply({
            content: `That's ${ctx.interaction.targetUser.username}.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
```

For message commands, use `ApplicationCommandType.Message`,
`MessageContextCommandBuilder`, and `ctx.interaction.targetMessage`. A slash
command and a context menu can share a name, since Discord treats them as
different types. Context menus can't have options or autocomplete.

## Deploying

Commands deploy when the client is created, if you passed `commands` options:
- With `guildIds`, each listed server gets your commands immediately.
- Without it, they deploy globally.

Deploying overwrites every command in that scope, so anything registered outside
Hyperion disappears. If your command folder is empty, Hyperion skips deploying
rather than wiping everything. And if one server fails partway through a
multi-server deploy, the servers that already succeeded keep the new commands.

## Finding a command in code

`client.commands` holds every loaded command:

```ts
client.commands.resolve("ping");
client.commands.resolveSubcommand("ticket", "close");
client.commands.resolveSubcommand("ticket", "view", "settings");
```
