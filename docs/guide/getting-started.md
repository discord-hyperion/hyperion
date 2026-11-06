# Getting started

Let's get a bot answering `/ping`. You'll need Node.js 24.17 or newer, a Discord
application with a bot token, and a server to test in.

## Project layout

Hyperion finds your code by folder. Everything lives under `src`, next to your
entry file:

```files
my-bot/
├── index.ts
└── src/
    ├── commands/
    │   └── ping.ts
    ├── buttons/
    ├── select-menus/
    ├── modals/
    └── events/
```

Every folder is optional, so only create the ones you use. Subfolders are fine
too; they're just for organising.

## Your first command

Each file default-exports one class. A command gets a builder (the same
`@discordjs/builders` you'd use with plain discord.js) and a `run()` method:

```ts
// src/commands/ping.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";

export default class PingCommand extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Check whether the bot is responding."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong!");
    }
}
```

`ctx.interaction` is the regular discord.js interaction, so everything you know
about replying still applies.

## Creating the client

```ts
// index.ts
import { HyperionClient } from "@hyperion/core";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !applicationId || !guildId) {
    throw new Error("Missing bot configuration.");
}

const client = await HyperionClient.create({
    name: "MyBot",
    root: new URL("./", import.meta.url),
    discord: { intents: ["Guilds"] },
    commands: { applicationId, token, guildIds: [guildId] },
});

await client.login(token);
```

`create()` loads every handler and deploys your commands before it returns, so
mistakes show up at startup rather than when someone clicks something. Logging
in is a separate step.

Passing `guildIds` deploys to those servers only, which updates instantly and is
perfect while you develop. Leave it out to deploy globally.

> [!WARNING]
> Deploying replaces _all_ commands in that scope, including ones you registered
> some other way.

Hyperion doesn't read `.env` files for you. Set the variables however you
normally start your bot.

## Running it

Run `index.ts` with a TypeScript runner such as `tsx`. There's no build step
during development. Invite the bot to your test server, wait for the ready log,
and type `/ping`. That's it!

## Where next

- More command shapes, like `/ticket close`: [commands](commands.md).
- Buttons and menus: [buttons](buttons.md) and [select menus](select-menus.md).
- Only letting certain people run something: [guards](guards.md).
