# Guards

A guard is a check that runs before your handler. Return `true` to let the
interaction through, `false` to stop it. They're how you say "owner only",
"moderators only", or "slow down" without cluttering every `run()` method.

## Using a guard

Every handler (commands, buttons, menus, modals) takes a `guards` array:

```ts fragment
import { defineCommand, ownerOnly } from "@hyperion/core";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("shutdown")
        .setDescription("Stop the bot."),
    guards: [ownerOnly],
    run: async ctx => {
        await ctx.interaction.reply("Shutting down.");
        await ctx.client.destroy();
    },
});
```

Guards run in order, and the first one to say no stops everything after it.
When a guard rejects, the user gets its description as a private reply.

Guards belong to the handler they're on. A command's guards don't protect the
buttons it sends, so add guards to those buttons as well.

## Writing your own

Give `defineGuard()` a name, a description, and a check:

```ts
import { defineGuard } from "@hyperion/core";

export const threadsOnly = defineGuard({
    name: "threads-only",
    description: "Use this in a thread.",
    run: ctx => ctx.interaction.channel?.isThread() ?? false,
});
```

| Option        | What it's for                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `name`        | Shows in the logs when the guard rejects someone.                                                        |
| `description` | The private reply a rejected user gets.                                                                  |
| `run`         | Returns `true` to let the interaction through. Can be async.                                             |
| `onFail`      | Optional. Replies instead of the description; see [custom rejection replies](#custom-rejection-replies). |

A guard is for commands unless you say otherwise. To use one elsewhere, name the
context it expects:

```ts fragment
// Commands only (the default)
defineGuard({ name, description, run: ctx => … });

// Buttons only: pass the context as a type argument…
defineGuard<ButtonContext>({ name, description, run: ctx => … });

// …or type run's parameter
defineGuard({ name, description, run: (ctx: ModalContext) => … });

// Every kind of handler
defineGuard<InteractionContext>({ name, description, run: ctx => … });
```

TypeScript stops you from putting a guard on the wrong kind of handler.

## Guards with settings

Need a value, like an allowed server ID? Wrap the guard in a function:

```ts fragment
const allowedGuild = (guildId: string) =>
    defineGuard({
        name: "allowed-guild",
        description: "Use this in the configured server.",
        run: ctx => ctx.interaction.guildId === guildId,
    });

guards: [allowedGuild("123456789012345678")];
```

## Keeping state

Guards don't have fields, but closures do the same job. Anything declared in the
outer function lives as long as the guard:

```ts fragment
const rateLimit = (max: number) => {
    const counts = new Collection<string, number>();

    return defineGuard({
        name: "rate-limit",
        description: "You're doing that too often.",
        run: ctx => {
            const used = counts.get(ctx.interaction.user.id) ?? 0;
            counts.set(ctx.interaction.user.id, used + 1);
            return used < max;
        },
    });
};
```

For state shared between several guards, create it outside and pass it in. For
state that should be fresh on every interaction, use a factory (below).

## Factories

Instead of a guard, you can put a function in `guards` that _returns_ one. It's
called each time an interaction reaches it, with the same context the handler
gets:

```ts fragment
guards: [ctx => accessCheck(ctx.interaction.user.id)];
```

Factories can be async, and they're skipped if an earlier guard already said no.

## Custom rejection replies

Add `onFail()` to send your own reply instead of the description:

```ts fragment
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

> [!WARNING]
> When `onFail()` exists, Hyperion sends nothing itself, so make sure you
> respond. If an earlier guard already replied, check `replied` or `deferred`
> first.

## Built-in guards

- **`ownerOnly`**: only the bot application's owner (the team owner, for team
  apps). Hyperion looks the owner up from Discord and caches it, so there's
  nothing to configure.
- **`guildOnly`**: only in a server, not in DMs.
- **`requirePermissions()`** and **`requireBotPermissions()`**: the user, or
  the bot, needs every permission you list, in the channel it's used in:

  ```ts fragment
  guards: [
      requirePermissions("ManageMessages"),
      requireBotPermissions("ManageMessages"),
  ];
  ```

  The rejection lists the permissions you asked for: "You need the Manage
  Messages permission to use this." For commands, `setDefaultMemberPermissions()` on the builder
  also hides the command from people who can't use it; the guard still protects
  buttons and menus.
- **`cooldown()`**: rejects while a key is cooling down. You own the collection
  of timers, so one cooldown can span several commands. Use a factory to key it
  per user:

  ```ts fragment
  const cooldowns = new Collection<string, number>();

  guards: [
          ctx =>
          cooldown({
              key: `refresh:${ctx.interaction.user.id}`, // what's cooling down
              durationMs: 5_000,
              entries: cooldowns, // where the timers live
          }),
  ];
  ```

  The cooldown starts as soon as the guard passes, even if the handler fails
  later. It lives in memory, so it resets on restart. For one that survives
  restarts, keep it in [SQLite](storing-data.md#quick-values) with a `ttl`.
- **`paramOwner()`**: for handlers with [params](custom-ids.md). Passes only
  when the params are valid and the key you name holds the clicking user's ID.
  An optional second argument replaces the description.

## Things to know

- Hyperion doesn't defer before guards, so keep them fast.
- Guards never see `ctx.input`; [typed input](input.md) is processed after they pass.
- Autocomplete skips guards entirely; see [autocomplete](autocomplete.md).
- If a guard throws, the user gets the generic error message described in
  [responding](responding.md).
