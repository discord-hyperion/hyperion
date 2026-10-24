# Command guards

Guards run before a slash command's `run()` method. A guard returns `true` to
continue or `false` to reject the invocation. Hyperion runs guards in array order
and stops at the first rejection or error.

Use a reusable instance for a stateless check, or a factory when the guard needs
invocation-specific state. Both forms can appear in the same array:

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, Guard, OwnerOnly } from "@hyperion";

class AllowedGuild extends Guard {
    public constructor(private readonly guildId: string) {
        super({
            name: "allowed-guild",
            description: "Use this command in the configured server.",
        });
    }

    public override run(ctx: CommandContext): boolean {
        return ctx.interaction.guildId === this.guildId;
    }
}

export default class AdminPing extends Command {
    public constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("admin-ping")
                .setDescription("Check the bot's administrative access."),
            guards: [new OwnerOnly(), () => new AllowedGuild("YOUR_SERVER_ID")],
        });
    }

    public override async run(ctx: CommandContext): Promise<void> {
        await ctx.interaction.reply("Pong!");
    }
}
```

Configure `ownerIds` on `HyperionClient.create()` for `OwnerOnly`. An empty or
omitted owner list denies everyone; Hyperion does not look up application owners.
Guards are runtime checks and do not change Discord command visibility or command
permission settings.

The factory above illustrates the API; because its configuration is constant,
`new AllowedGuild("YOUR_SERVER_ID")` is also suitable. A factory receives the same
`CommandContext` as `run()`, `onFail()`, and the command handler. For example,
`ctx => new AccessCheck(ctx.interaction.user.id)` can bind per-invocation state.
Factories can also return a promise. They execute once each time an invocation
reaches them, never during command discovery or deployment. Later factories are
not called after a rejection. Pass a factory function, rather than a class
constructor.

Shared instances should keep request-specific values in local variables rather
than fields: multiple invocations can execute concurrently. Factories create
isolated instances but do not make shared dependencies concurrency-safe. Keep
cross-invocation state, such as cooldowns, in a deliberately shared service rather
than recreating it inside each factory.

## Rejection responses

`Guard` requires a `description`, used as the default rejection message. A fresh
interaction receives an ephemeral reply. A deferred interaction has its reply
edited, retaining the visibility selected when deferring; an already replied
interaction receives an ephemeral follow-up.

Override `onFail()` to take control of the rejection response:

```ts
class GuildOnly extends Guard {
    public constructor() {
        super({ description: "This command requires a server." });
    }

    public override run(ctx: CommandContext): boolean {
        return ctx.interaction.inGuild();
    }

    public override async onFail(ctx: CommandContext): Promise<void> {
        await ctx.interaction.reply({
            content: "Please run this command in a server.",
            flags: MessageFlags.Ephemeral,
        });
    }
}
```

Import `MessageFlags` from `discord.js` and `Guard` / `CommandContext` from
`@hyperion` for this example. Hyperion awaits `onFail()` exactly once and adds no
default response when it succeeds. The callback is responsible for acknowledging
the interaction, including checking `replied` / `deferred` if earlier guards may
already have acknowledged it. A passing guard never runs `onFail()`.

Hyperion does not automatically defer. Async guards and factories must acknowledge
within Discord's interaction deadline if they perform slow work. Deferring changes
what later handlers can do: a handler cannot open a modal after acknowledgment.
Coordinate that policy across the guard chain and the command.

## Errors and logging

A thrown or rejected factory, `run()`, or `onFail()` stops execution and logs
`command.failed` with `stage: "guards"`. The user receives the existing generic
command error response; exception details are not exposed. Invalid factory
results and checks returning anything other than a boolean also fail closed.
Malformed shared instances are rejected when constructing the command.

Guards receive `ctx.logger` with the same invocation metadata as the handler.
`guard.started` and `guard.passed` appear at debug level; `guard.rejected` and
`command.rejected` appear at info level. Guard outcome records include the guard
name and check duration. A rejected command does not emit `command.completed`.
Set `logging.level` to `debug` to inspect individual passing checks.

The current dispatcher supports slash-command guards. `Guard<Context>` and
`GuardFactory<Context>` are generic so future handler types can supply their own
context without adding separate check methods to every guard.
