# Getting started

Create a Hyperion bot that responds to `/ping`. You need Node.js 24.17 or newer, a Discord application with a bot token, and a test server.

## Installing

Hyperion targets prerelease builds of `discord.js` v15 and `@discordjs/builders` (see the [FAQ](faq.md) for why prerelease versions are pinned). Install the exact versions it was built against, along with `tsx` to run TypeScript directly:

```npm
npm install @hyperion-js/core@beta discord.js@15.0.0-dev.1792497873-5050a3b54 @discordjs/builders@2.0.0-dev.1792497873-5050a3b54
```

```npm
npm install -D tsx
```

## Project layout

Hyperion discovers handlers from five fixed folders under `src/`: `commands`, `buttons`, `select-menus`, `modals`, and `events`. Missing folders are skipped at startup, so you only need to create the ones your bot uses:

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

`root` defaults to `process.cwd()`, so anchoring it with `new URL("./", import.meta.url)` ensures Hyperion finds `src/` regardless of the working directory you launch from. `name` labels the bot's log output, and passing `commands` enables loading and deploying `src/commands/`.

`HyperionClient.create()` loads every handler, validates your configuration, and deploys your commands before it returns, so mistakes fail at startup rather than on a user interaction. Passing `guildIds` deploys commands to those servers immediately; omit `guildIds` to deploy globally. Logging in to Discord is a separate step.

> [!NOTE]
> Hyperion does not load `.env` files for you. Load environment variables with Node's `--env-file` flag or a package such as [`dotenv`](https://www.npmjs.com/package/dotenv).

## Running the bot

Invite the bot to your test server with both the `bot` and `applications.commands` OAuth2 scopes, then start it with `tsx`:

```sh
npx tsx --env-file=.env index.ts
```

Wait for the `Discord client ready` log entry, then run `/ping` in your test server.

## Next steps

- Read [How Hyperion works](how-hyperion-works.md) to see the startup flow, interaction pipeline, and error handling.
- Add subcommands and context menus in [Commands](commands.md).
- Handle interactive controls in [Buttons](buttons.md) and [Select menus](select-menus.md).
- Restrict who can use handlers in [Guards](guards.md).
