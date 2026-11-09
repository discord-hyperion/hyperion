# Filesystem command registration

Place commands in `<bot root>/src/commands` and pass registration credentials to
`HyperionClient.create()`. Individual handler paths are fixed by convention.

```ts
import { HyperionClient } from "@hyperion-js/core";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !applicationId || !guildId) {
    throw new Error("Missing bot configuration.");
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

Put this example in your bot’s `index.ts`. Supply environment variables through
your startup environment. Hyperion does not read environment files itself.

The bot layout is:

```text
my-bot/
├── index.ts
└── src/
    └── commands/
        ├── (general)/
        │   ├── ping.ts
        │   └── topic.ts
        ├── (components)/
        │   └── profile.ts
        └── (context-menus)/
            ├── inspect-user.ts
            └── inspect-message.ts
```

Parenthesized folders organize examples without changing their command names.
The parent and subcommand-group folder syntax is documented in
[Command path conventions](command-paths.md). Subcommands under `[parent]` folders
are registered together and dispatched to their leaf modules. `{group}` folders
add another level through explicit [group definitions](subcommand-groups.md).

`root` defaults to `process.cwd()` and can be a filesystem path or file URL.
Set it relative to your bot entry point
as shown above. Hyperion scans only `<root>/src/commands`, including its nested
folders. A missing command folder (or missing `src`) is skipped, with no deployment
request. An existing empty folder also results in no deployment. Other filesystem
errors, such as an unreadable folder or a file where a folder is expected, fail
initialization rather than being silently ignored.

Standalone command modules default-export the command `defineCommand()` returns,
with a `run()` function. Inside `[parent]`, leaf modules use `defineSubcommand()`
instead; the direct `index.ts` uses `defineParentCommand()` and supplies shared
metadata and guards without `run()`. See
[Command path conventions](command-paths.md) for complete examples.

Supported extensions are `.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`, `.cjs`,
and `.jsx`.
Barrels named `index.*` (except direct parent/group definitions), TypeScript declarations, test files, hidden entries,
and `node_modules` are skipped. Keep only command modules in the command tree;
place other helpers elsewhere. Load source files or compiled files, not both.

Commands accept a `ChatInputCommandBuilder` from the v15-compatible
`@discordjs/builders` package:

```ts
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

The same registry also supports user and message [context-menu commands](context-menu-commands.md).
Use `Command<ApplicationCommandType.User>` or `Command<ApplicationCommandType.Message>`
with the matching v15 builder; its payload determines the runtime type. Plain `Command`
continues to define a chat-input command.

The registry checks the exported class, executable handler, named builder, and
duplicate names. It uses unvalidated serialization only to obtain the lookup name
during discovery. Before any request is sent, every builder is serialized with
`toJSON()`, letting Discord's builder library validate and construct the API
payload. Hyperion does not maintain its own payload schema. Builder errors include
the source file and retain the original error as their cause. Discord performs
the final server-side validation.
Serialization respects the builders package's global validator setting. It is
enabled by default; explicitly disabling it opts out of local SDK payload checks,
including checks on composed parents and groups. Hyperion's routing and
filesystem invariants still apply. See [architecture](architecture.md).
Registration errors retain Discord's original error as their cause and include
the target route. Indexed validation errors also identify the corresponding
command name and source file, for example `body[2]: "ping" (/path/to/ping.ts)`.

All files load before any deployment request is sent, event handlers included. Providing `guildIds`
performs one bulk overwrite per unique guild. Omitting `guildIds` performs a
global bulk overwrite. An explicitly empty guild list is rejected.

Before each overwrite, the registry reads the scope's registered commands
(`GET` with `with_localizations=true`) and compares them with the serialized
body. The comparison ignores command order, server-side fields (`id`,
`application_id`, `guild_id`, `version`, and localized names), empty values,
fields at Discord's documented defaults, and the order of numeric sets such as
`contexts`. For guild scopes, it also ignores `contexts`, `integration_types`,
and `dm_permission`, which Discord applies only to global commands and doesn't
return as sent. Option and choice order still count. When nothing differs, the
scope is skipped and logged as `commands.unchanged`; otherwise the overwrite
logs the added, removed, and changed command names, with the paths of the
fields that differ for each changed command. If the registered commands
can't be read, the registry logs a warning and overwrites anyway, so a failed
comparison never leaves commands stale. A field Discord fills in some other
way only causes an unnecessary overwrite.

**Bulk overwrites replace all application commands in the selected scope, including
commands registered outside Hyperion.** Initialization skips empty registries;
directly calling `register()` on an empty registry is rejected to avoid accidentally
clearing commands. Registrations already completed in one
guild cannot be rolled back automatically if a subsequent guild request fails.

If no `commands` options are provided, the client starts with an empty registry
and does not deploy anything. Module import, validation, and deployment errors
reject `create()`; initialization failures destroy the local client.

## Command execution

After initialization, the client routes slash and context-menu commands by name
and application-command type. The handler receives a fresh `CommandContext`
containing the Hyperion client and its typed interaction. Button interactions
are routed through [button handlers](./buttons.md), message selects through
[select menu handlers](./select-menus.md), and modal submissions through
[modal handlers](./modals.md). Autocomplete has its own response pipeline;
unsupported interaction types are left alone.

Optional command `guards` run in order before the handler. They accept shared
instances or lazy per-invocation factories. The first rejection or error stops
execution; see [Guards](./guards.md) for configuration and custom responses.

Handlers control acknowledgment by default. Reply, defer, or open a modal as
appropriate. Commands with an [input schema](input-validation.md) can set
`input: { schema, defer: true }` to defer privately after guards and before input processing,
unless a guard already acknowledged the interaction. Otherwise, slow handlers
can call `deferReply()` before awaiting their work, then `editReply()` to deliver
the result.

Schema validation runs after guards; an optional whole-input resolver then
receives the validated values and returns the complete handler input. Expected
schema issues reach the handler as `[issues, undefined]`; success supplies
`[null, input]` through `ctx.input`. Handlers decide how to present issues.
Resolver and schema exceptions stop execution and use the generic error
response below. Commands without schemas retain the original context.

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
lifecycle, and authorization requirements. Validate submitted values again in
the normal command handler.
