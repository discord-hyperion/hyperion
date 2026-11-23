# Getting started

This guide walks you through creating a bot that responds to `/ping`. You need Node.js 24.17 or newer, a Discord application with a bot token, and a test server.

## Installing

Hyperion is in beta and targets prerelease versions of `discord.js` v15 and `@discordjs/builders`. Install the exact versions it was built against:

```npm
npm install @hyperion-js/core@beta discord.js@15.0.0-dev.1792497873-5050a3b54 @discordjs/builders@2.0.0-dev.1792497873-5050a3b54
```

## Project layout

Hyperion discovers handlers from folders under `src/`, next to your entry file. Start with this layout:

```files
my-bot/
├── index.ts
└── src/
    └── commands/
        └── ping.ts
```

Hyperion loads `ping.ts` from `src/commands/` and deploys the command at startup.

## Your first command

Each handler file default-exports the result of a `define*()` function, such as `defineCommand()` or `defineButton()`. Create `src/commands/ping.ts`:

```ts
// src/commands/ping.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("ping")
        .setDescription("Check whether the bot is responding."),
    run: async ctx => {
        await ctx.interaction.reply("Pong!");
    },
});
```

`ctx.interaction` is the standard discord.js interaction object, so replying works the same way as in plain discord.js.

## Creating the client

Create `index.ts` to initialize the client, deploy commands, and log in:

```ts
// index.ts
import { HyperionClient } from "@hyperion-js/core";

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
    commands: {
        applicationId,
        token,
        guildIds: [guildId],
    },
});

await client.login(token);
```

`HyperionClient.create()` loads every handler, validates your configuration, and deploys your commands before it returns. Configuration errors fail immediately at startup instead of when a user triggers an interaction. Logging in to Discord is a separate step.

Passing `guildIds` deploys commands only to those servers, where updates appear right away. Omit `guildIds` to deploy commands globally.

> [!NOTE]
> Hyperion does not load `.env` files for you. Load environment variables with Node's `--env-file` flag or a package like [`dotenv`](https://www.npmjs.com/package/dotenv).

## Running the bot

Run `index.ts` with a TypeScript runner such as `tsx`. Invite the bot to your test server, wait for the ready log, and run `/ping`.

## Next steps

- Learn about subcommands and context menus in [Commands](commands.md).
- Add interactive controls in [Buttons](buttons.md) and [Select menus](select-menus.md).
- Restrict who can use handlers in [Guards](guards.md).
