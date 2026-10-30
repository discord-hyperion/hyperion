# Command guards

See the [execution glossary](GLOSSARY.md#execution) for guard and guard-provider
terminology.

`OwnerOnly` and `Cooldown` are built-in guards supplied by Hyperion, located in
`src/guards/builtins` and exported from the public library entry point. Use them
directly; custom guard subclasses are only needed for application-specific checks.

Guards run before a slash command's `run()` method. A guard returns `true` to
continue or `false` to reject the invocation. Hyperion runs guards in array order
and stops at the first rejection or error.

Use a reusable instance for a stateless check, or a factory when the guard needs
invocation-specific state. Both forms can appear in the same array:

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, Guard, OwnerOnly } from "@hyperion/core";

class AllowedGuild extends Guard {
    constructor(private readonly guildId: string) {
        super({
            name: "allowed-guild",
            description: "Use this command in the configured server.",
        });
    }

    run(ctx: CommandContext) {
        return ctx.interaction.guildId === this.guildId;
    }
}

export default class AdminPing extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("admin-ping")
                .setDescription("Check the bot's administrative access."),
            guards: [new OwnerOnly(), () => new AllowedGuild("YOUR_SERVER_ID")],
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.reply("Pong!");
    }
}
```

`OwnerOnly` fetches the running bot application's owner through Discord's API.
Personal applications use their owner's user ID; team applications use the team
owner's user ID, not every team member. No owner configuration is required.
Hyperion starts the lookup when the client becomes ready and caches successful
results for that login. Concurrent guards share the same in-flight request.
Failed requests are logged and may be retried by the next invocation. Before
login, or if ownership cannot be resolved, the guard fails closed and the handler
does not run. `client.getOwnerId()` exposes the same cached lookup.
Guards are runtime checks and do not change Discord command visibility or command
permission settings.

The factory above illustrates the API; because its configuration is constant,
`new AllowedGuild("YOUR_SERVER_ID")` is also suitable. A factory receives the original
`CommandContext`, shared with guard `run()` and `onFail()`. For example,
`ctx => new AccessCheck(ctx.interaction.user.id)` can bind per-invocation state.
Factories can also return a promise. They execute once each time an invocation
reaches them, never during command discovery or deployment. Later factories are
not called after a rejection. Pass a factory function, rather than a class
constructor.

`Cooldown` illustrates a configurable guard with invocation-specific policy:

```ts
import { Collection } from "discord.js";

const cooldowns = new Collection<string, number>(); // Shared outside the factory.

// Inside button options:
guards: [
    ctx => new Cooldown({
        key: `profile.refresh:${ctx.interaction.user.id}`,
        durationMs: 5_000,
        entries: cooldowns,
    }),
],
```

Import `Cooldown` from `@hyperion/core`. The application chooses the cooldown namespace,
key, duration, and backing collection. The factory binds the key for each user, while the
collection survives across invocations. A fixed key with a shared guard instance would
apply one cooldown to all callers. A factory is useful for this per-user policy;
it is not inherently required by the guard class.

Passing the guard consumes the cooldown immediately, even if a later guard or
handler fails. Rejected attempts do not extend the expiry. Expired entries are
removed on subsequent checks. This implementation is synchronous and local to one
process; restarts reset the supplied in-memory collection. Multi-process bots need a
shared service with an atomic check-and-set operation. Use a dedicated collection for
cooldown expiry timestamps, not arbitrary application data.

Checks whose entire condition comes from `ctx` can live directly in `run(ctx)`
without a factory. Do not wrap such checks in a factory just to pass values they
already have access to.

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
    constructor() {
        super({ description: "This command requires a server." });
    }

    run(ctx: CommandContext) {
        return ctx.interaction.inGuild();
    }

    async onFail(ctx: CommandContext) {
        await ctx.interaction.reply({
            content: "Please run this command in a server.",
            flags: MessageFlags.Ephemeral,
        });
    }
}
```

Import `MessageFlags` from `discord.js` and `Guard` / `CommandContext` from
`@hyperion/core` for this example. Hyperion awaits `onFail()` exactly once and adds no
default response when it succeeds. The callback is responsible for acknowledging
the interaction, including checking `replied` / `deferred` if earlier guards may
already have acknowledged it. A passing guard never runs `onFail()`.

Hyperion does not automatically defer before guards. Async guards and factories must acknowledge
within Discord's interaction deadline if they perform slow work. Deferring changes
what later handlers can do: a handler cannot open a modal after acknowledgment.
Coordinate that policy across the guard chain and the command.

For commands with [input schemas](input-validation.md), guards and their
factories still receive the original context without `ctx.input`. Input
validation and subsequent whole-input resolution run only after every guard passes. Optional
`input: { schema, defer: true }` also takes effect after guards, preserving any acknowledgment
already made by a guard. A later schema failure does not refund a cooldown.

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

The dispatcher supports command, [button](./buttons.md), and
[select menu](./select-menus.md) guards. Custom button
guards extend `Guard<ButtonContext>`; select menu guards extend
`Guard<SelectMenuContext>`. Guards shared across interaction types can accept
`InteractionContext`. `OwnerOnly` already supports both. Each handler has its own
guard list: restricting a command does not automatically restrict its components.
`Guard<Context>` and `GuardFactory<Context>` accept the handler's context without
adding separate execution methods to every guard.
