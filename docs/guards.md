# Guards

See the [execution glossary](GLOSSARY.md#execution) for guard and guard-provider
terminology.

Guards are execution checks, not handlers: define them with `defineGuard()`
rather than a class. `ownerOnly`, `guildOnly`, `requirePermissions()`,
`requireBotPermissions()`, `cooldown()`, and `paramOwner()` are built-in guards
supplied by Hyperion, located in `src/guards/builtins` and exported from
the public library entry point. Use them directly; define your own only for
application-specific checks.

Guards run before a handler's `run()` method. A guard returns `true` to continue
or `false` to reject the invocation. Hyperion runs guards in array order and
stops at the first rejection or error.

## Define a guard

```ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand, defineGuard, ownerOnly } from "@hyperion-js/core";

const allowedGuild = (guildId: string) =>
    defineGuard({
        name: "allowed-guild",
        description: "Use this command in the configured server.",
        run: ctx => ctx.interaction.guildId === guildId,
    });

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("admin-ping")
        .setDescription("Check the bot's administrative access."),
    guards: [ownerOnly, allowedGuild("YOUR_SERVER_ID")],
    run: async ctx => {
        await ctx.interaction.reply("Pong!");
    },
});
```

`defineGuard({ name, description, run, onFail? })` returns a frozen guard.
- `name` is required and appears in rejection logs. `description` is the default
  rejection reply.
- `run(ctx)` and `onFail(ctx)` receive only the context; there is no `this` state
  to rely on.
- The context type comes from an explicit generic
  (`defineGuard<ButtonContext>({ … })`), otherwise from an annotation on `run`'s
  parameter (`run: (ctx: ModalContext) => …`), otherwise it defaults to
  `CommandContext`. A guard written for one context cannot be attached to a
  handler with an incompatible one.
- A guard that takes arguments is a plain function returning a definition, as
  `allowedGuild(guildId)` shows. There is no separate parameterized form.

Only values returned by `defineGuard()` are guards; an object with the same
fields is rejected when the handler is constructed.

## State

Guards keep state in closures rather than fields. Choose by how long the state
must live:
- **Per guard.** Declare it in the function that returns the definition. Every
  invocation that uses this guard shares it:

  ```ts fragment
  const rateLimit = (max: number) => {
      const counts = new Collection<string, number>();

      return defineGuard({
          name: "rate-limit",
          description: "You are doing that too often.",
          run: ctx => {
              const used = counts.get(ctx.interaction.user.id) ?? 0;
              counts.set(ctx.interaction.user.id, used + 1);
              return used < max;
          },
      });
  };

  guards: [rateLimit(5)];
  ```

- **Shared across guards.** Pass it in, as `cooldown()` does with `entries`, so
  the application owns it.
- **Per invocation.** Use a factory, `ctx => defineGuard({ … })`. It runs once
  each time an invocation reaches it.

Invocations can run concurrently, so keep request-specific values in local
variables. Closures do not make shared state concurrency-safe; coordinate writes
in the service that owns it.

## Factories

A guard provider is either a guard or a factory that returns one:

```ts fragment
guards: [ownerOnly, ctx => accessCheck(ctx.interaction.user.id)];
```

A factory receives the original handler context, shared with guard `run()` and
`onFail()`, and may return a promise. It executes once each time an invocation
reaches it, never during discovery or deployment. Later factories are not called
after a rejection. Checks whose entire condition comes from `ctx` can live in
`run(ctx)` without a factory; do not add a factory just to pass values the guard
already has.

## Built-in guards

`ownerOnly` fetches the running bot application's owner through Discord's API.
Personal applications use their owner's user ID; team applications use the team
owner's user ID, not every team member. No owner configuration is required.
Hyperion starts the lookup when the client becomes ready and caches successful
results for that login. Concurrent guards share the same in-flight request.
Failed requests are logged and may be retried by the next invocation. Before
login, or if ownership cannot be resolved, the guard fails closed and the handler
does not run. `client.getOwnerId()` exposes the same cached lookup. Guards are
runtime checks and do not change Discord command visibility or command
permission settings.

`guildOnly` passes only when `interaction.inGuild()` is true, so it rejects DMs
and group DMs. Its description is "Use this in a server."

`requirePermissions(...permissions)` passes when `interaction.memberPermissions`
has every given permission; Discord computes it for the invoking member in the
interaction's channel, so channel overwrites apply. `requireBotPermissions()`
checks `interaction.appPermissions`, the bot's permissions in that channel. Both
accept any discord.js `PermissionResolvable` (names, `PermissionFlagsBits`, or
bigints), pass for `Administrator`, and fail closed when the permissions are
missing, as outside a server. Arguments are resolved when the guard is created:
an unknown name throws, and an empty list throws `RangeError`. The description
lists every requested permission, not only the missing ones, for example "You need the
Kick Members and Manage Messages permissions to use this." or "I need the Manage
Roles permission here." Names come from the discord.js flag names, so
`ManageGuild` reads "Manage Guild". Use `onFail()` in a custom guard for other
wording. These guards are runtime checks. For commands, also consider
`setDefaultMemberPermissions()` on the builder, which hides the command from
members without the permission; guards still matter for components and for
permissions that change after deployment.

`cooldown()` takes the key, duration, and a collection the application owns:

```ts fragment
import {
    Collection,
} from "discord.js";

const cooldowns = new Collection<string, number>(); // Shared outside the factory.

// Inside button options:
guards: [
    ctx =>
        cooldown({
            key: `profile.refresh:${ctx.interaction.user.id}`,
            durationMs: 5_000,
            entries: cooldowns,
        }),
],
```

The factory binds the key for each user, while the collection survives across
invocations. A fixed key on a shared guard would apply one cooldown to all
callers. `cooldown()` throws when `durationMs` is not a positive, finite number.

Passing the guard consumes the cooldown immediately, even if a later guard or
handler fails. Rejected attempts do not extend the expiry. Expired entries are
removed on subsequent checks. This implementation is synchronous and local to one
process; restarts reset the supplied in-memory collection. A
[SQLite key-value namespace](sqlite.md#key-value-namespaces) with `ttl` keeps
cooldowns across restarts. Multi-process bots
need a shared service with an atomic check-and-set operation. Use a dedicated
collection for cooldown expiry timestamps, not arbitrary application data.

## Ownership from custom-ID params

`paramOwner()` checks a handler's [custom-ID params](custom-id-params.md): it
passes only when the params are valid and `params[key]` equals the user's ID.
That stops other users from using a control built for someone else. It isn't
proof of ownership: it trusts the ID the custom ID carries, and doesn't check who
owns the resource now. Check current ownership against application state when
that matters. It is opt-in and works on any handler kind that declares params:

```ts fragment
guards: [paramOwner("owner", "Only the ticket's author can close it.")];
```

The key must exist in the handler's params as a string, or the guard does not
compile. The description defaults to "Only the person this was sent for can use
it." Params are validated before guards, so the guard sees `ctx.params`.

## Rejection responses

A rejected guard's `description` is the default reply. A fresh interaction
receives an ephemeral reply. A deferred interaction has its reply edited,
retaining the visibility selected when deferring; an already replied interaction
receives an ephemeral follow-up.

Supply `onFail()` to take control of the rejection response:

```ts
import { defineGuard, type InteractionContext } from "@hyperion-js/core";
import { MessageFlags } from "discord.js";

export const threadsOnly = defineGuard<InteractionContext>({
    name: "threads-only",
    description: "Use this in a thread.",
    run: ctx => ctx.interaction.channel?.isThread() ?? false,
    onFail: async ctx => {
        if (!ctx.interaction.isRepliable()) return;

        await ctx.interaction.reply({
            content: "Open a thread first, then run this there.",
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

Hyperion awaits `onFail()` exactly once and adds no default response when it
succeeds. The callback is responsible for acknowledging the interaction,
including checking `replied` / `deferred` if earlier guards may already have
acknowledged it. A passing guard never runs `onFail()`.

Hyperion does not automatically defer before guards. Async guards and factories
must acknowledge within Discord's interaction deadline if they perform slow work.
Deferring changes what later handlers can do: a handler cannot open a modal after
acknowledgment. Coordinate that policy across the guard chain and the handler.

For handlers with [input schemas](input-validation.md), guards and their
factories still receive the original context without `ctx.input`. Input
validation and subsequent whole-input resolution run only after every guard
passes. Optional `input: { schema, defer: true }` also takes effect after guards,
preserving any acknowledgment already made by a guard. A later schema failure
does not refund a cooldown.

## Errors and logging

A thrown or rejected factory, `run()`, or `onFail()` stops execution and logs
`command.failed` with `stage: "guards"`. The user receives the existing generic
command error response; exception details are not exposed. Invalid factory
results and checks returning anything other than a boolean also fail closed.
Providers that are neither guards nor factories are rejected when constructing
the handler.

Guards receive `ctx.logger` with the same invocation metadata as the handler.
`guard.started` and `guard.passed` appear at debug level; `guard.rejected` and
`command.rejected` appear at info level. Guard outcome records include the guard
name and check duration. A rejected command does not emit `command.completed`.
Set `logging.level` to `debug` to inspect individual passing checks.

## Contexts

The dispatcher supports command, [button](./buttons.md),
[select menu](./select-menus.md), and [modal](./modals.md) guards. A button guard
is a `Guard<ButtonContext>`, a select-menu guard a `Guard<SelectMenuContext>`.
Guards shared across interaction types can accept `InteractionContext`, as
every built-in except `paramOwner()` does. Each handler has its own guard list: restricting
a command does not automatically restrict its components.
