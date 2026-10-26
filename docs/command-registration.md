# Filesystem command registration

Place commands in `<bot root>/src/commands` and pass registration credentials to
`HyperionClient.create()`. Individual handler paths are fixed by convention.

```ts
import { HyperionClient } from "@hyperion";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !applicationId || !guildId) {
    throw new Error("Missing development bot configuration.");
}

const client = await HyperionClient.create({
    name: "HyperionDev",
    root: new URL("./", import.meta.url),
    discord: { intents: ["Guilds"] },
    commands: {
        applicationId,
        token,
        guildIds: [guildId],
    },
});

// Initialization has finished and client.commands contains the loaded handlers.
// Login is separate from command deployment.
await client.login(token);
```

This example belongs in `dev/bot/index.ts`. Supply environment variables through
your startup environment. Hyperion does not read environment files itself.

The bot layout is:

```text
dev/bot/
├── index.ts
└── src/
    └── commands/
        └── ping.ts
```

`root` defaults to `process.cwd()` and can be a filesystem path or file URL.
For a dev bot in the framework repository, set it relative to the bot entry point
as shown above. Hyperion scans only `<root>/src/commands`, including its nested
folders. A missing command folder (or missing `src`) is skipped, with no deployment
request. An existing empty folder also results in no deployment. Other filesystem
errors, such as an unreadable folder or a file where a folder is expected, fail
initialization rather than being silently ignored.

Each command module must default-export a concrete `Command`
subclass with a public, zero-argument constructor and a `run()` method.

Supported extensions are `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, and `.cjs`.
Barrels named `index.*`, TypeScript declarations, test files, hidden entries,
and `node_modules` are skipped. Keep only command modules in the command tree;
place other helpers elsewhere. Load source files or compiled files, not both.

Commands accept a `ChatInputCommandBuilder` from the v15-compatible
`@discordjs/builders` package:

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion";

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

The registry checks the exported class, executable handler, named builder, and
duplicate names. It uses unvalidated serialization only to obtain the lookup name
during discovery. Before any request is sent, every builder is serialized with
`toJSON()`, letting Discord's builder library validate and construct the API
payload. Hyperion does not maintain its own payload schema. Builder errors include
the source file and retain the original error as their cause. Discord performs
the final server-side validation.
Registration errors retain Discord's original error as their cause and include
the target route. Indexed validation errors also identify the corresponding
command name and source file, for example `body[2]: "ping" (/path/to/ping.ts)`.

All files load before any deployment request is sent. Providing `guildIds`
performs one bulk overwrite per unique guild. Omitting `guildIds` performs a
global bulk overwrite. An explicitly empty guild list is rejected.

**Bulk overwrites replace all application commands in the selected scope, including
commands registered outside Hyperion.** Initialization skips empty registries;
directly calling `register()` on an empty registry is rejected to avoid accidentally
clearing commands. Registrations already completed in one
guild cannot be rolled back automatically if a subsequent guild request fails.

If no `commands` options are provided, the client starts with an empty registry
and does not deploy anything. Module import, validation, and deployment errors
reject `create()`; initialization failures destroy the local client.

## Command execution

After initialization, the client listens for slash-command interactions and looks
up each command by name. The handler receives a fresh `CommandContext` containing
the Hyperion client and the interaction. Button interactions are routed separately
through [button handlers](./buttons.md), and string, user, role, or mentionable selects through
[select menu handlers](./select-menus.md). Other interaction types are left alone.

Optional command `guards` run in order before the handler. They accept shared
instances or lazy per-invocation factories. The first rejection or error stops
execution; see [Command guards](./guards.md) for configuration and custom responses.

Handlers control acknowledgment themselves. Reply, defer, or open a modal as
appropriate; Hyperion does not automatically defer before calling `run()`.
For example, slow handlers can call `deferReply()` before awaiting their work,
then `editReply()` to deliver the result.

Handler failures are reported through Pino with the command and interaction ID.
Users receive a generic error message without internal exception details:
- Before acknowledgment: an ephemeral reply.
- After deferral, before a reply: an edit to the deferred response. This retains
  the original visibility selected by the handler.
- After a reply: an ephemeral follow-up.

Failures while sending these error messages are also reported and contained.
Unknown command names receive a private unavailable response. Successful handlers
are responsible for providing their own response; Hyperion adds no extra message.

Commands also receive `ctx.logger`, a Pino child logger carrying invocation
metadata. See [Logging and startup progress](./logging.md) for levels, coloured
output, startup indicators, and configuration.


## Autocomplete

Commands can also implement an optional `autocomplete(ctx)` hook. Enable it with
`.setAutocomplete(true)` on supported options; discovery and registration do not
execute hooks. See [autocomplete](autocomplete.md) for the typed API, response
lifecycle, and authorization requirements. The dev bot's `/topic` command
demonstrates autocomplete and validates submitted values in its normal handler.

## Development bot

The startup scripts now target `dev/bot/index.ts`:

```sh
pnpm dev          # Restart on source changes
pnpm start        # Run once
pnpm start:debug  # Run with the Node inspector
```

Configure `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, and `DISCORD_DEV_GUILD_ID`
yourself in the startup environment or your private root `.env` file. All three
are required by the development bot. Startup deploys commands to that development
guild before logging in; it does not perform global registration. Invite the
application to your test guild, start the bot, wait for the ready message, and
invoke `/ping` to receive `Pong!`.

These scripts load private environment files and must only be run by the user,
not by coding agents. Live Discord execution is separate from automated tests.

Run the registration and dispatch tests with `pnpm test`. The tests mock REST
requests and interactions and do not log in, contact Discord, or load environment
files.
