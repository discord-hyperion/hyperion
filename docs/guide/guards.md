# Guards

A guard is a check that runs before your handler. Return `true` to let the
interaction through, `false` to stop it. They're how you say "owner only",
"servers only", or "slow down" without cluttering every `run()` method.

## Using a guard

Every handler (commands, buttons, menus, modals) takes a `guards` array:

```ts fragment
import { ownerOnly } from "@hyperion/core";

super({
    builder: new ChatInputCommandBuilder().setName("shutdown").setDescription("Stop the bot."),
    guards: [ownerOnly],
});
```

Guards run in order, and the first one to say no stops everything after it.
When a guard rejects, the user gets its description as a private reply.

Guards belong to the handler they're on. A command's guards don't protect the
buttons it sends, so add guards to those buttons as well.

## Writing your own

Use `defineGuard()` with a name, a description (the rejection message), and a
`run` function:

```ts
import { defineGuard } from "@hyperion/core";

export const guildOnly = defineGuard({
    name: "guild-only",
    description: "Use this in a server.",
    run: ctx => ctx.interaction.inGuild(),
});
```

The name shows up in logs when the guard rejects someone.

By default a guard expects a command context. For other handlers, pass the
context as a generic (`defineGuard<ButtonContext>({ … })`) or type the `run`
parameter (`run: (ctx: ModalContext) => …`). Use `InteractionContext` for a
guard that works everywhere. TypeScript stops you from putting a guard on the
wrong kind of handler.

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
export const guildOnly = defineGuard<InteractionContext>({
    name: "guild-only",
    description: "Use this in a server.",
    run: ctx => ctx.interaction.inGuild(),
    onFail: async ctx => {
        if (!ctx.interaction.isRepliable()) return;

        await ctx.interaction.reply({
            content: "Tickets belong to a server. Run this there instead.",
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

When `onFail()` exists, Hyperion sends nothing itself, so make sure you
respond. If an earlier guard already replied, check `replied` or `deferred` first.

## Built-in guards

- **`ownerOnly`**: only the bot application's owner (the team owner, for team
  apps). Hyperion looks the owner up from Discord and caches it, so there's
  nothing to configure.
- **`cooldown({ key, durationMs, entries })`**: rejects while `key` is cooling
  down. You own the `entries` collection, so one cooldown can span several
  commands. Use a factory to key it per user:

  ```ts fragment
  const cooldowns = new Collection<string, number>();

  guards: [
      ctx => cooldown({ key: `refresh:${ctx.interaction.user.id}`, durationMs: 5_000, entries: cooldowns }),
  ];
  ```

  The cooldown starts as soon as the guard passes, even if the handler fails
  later. It lives in memory, so it resets on restart. For one that survives
  restarts, keep it in [SQLite](storing-data.md#quick-values) with a `ttl`.
- **`paramOwner(key, description?)`**: for handlers with
  [custom-ID params](custom-ids.md). Passes only when the params are valid and
  `params[key]` is the clicking user's ID.

## Things to know

- Hyperion doesn't defer before guards. Slow guards need to respond within
  Discord's three seconds, and deferring rules out opening a modal later.
- Guards never see `ctx.input`; [typed input](input.md) is processed after they pass.
- Autocomplete skips guards entirely; see [autocomplete](autocomplete.md).
- If a guard throws, the user gets the generic error message described in
  [responding](responding.md).
