# Guards

A guard runs before a handler executes, returning `true` to allow the interaction or `false` to reject it. Use guards for reusable ownership, permission, and rate-limit checks instead of repeating them across handlers.

## Using a guard

Commands, buttons, select menus, and modals accept a `guards` array:

```ts
// src/commands/shutdown.ts
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand, ownerOnly } from "@hyperion-js/core";

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

Guards run in array order. When a guard returns `false`, Hyperion skips all remaining guards and `run()`, and sends the guard's `description` as an ephemeral reply by default. Subcommands inherit parent and group guards from outermost to innermost; see [Subcommands](commands.md#subcommands).

> [!WARNING]
> Guards apply only to the handler they are attached to. A command's guards do not protect buttons, select menus, or modals sent by that command—attach guards to those component handlers as well.

## Writing a custom guard

Create every guard with `defineGuard()`, supplying a `name`, a `description`, and a `run()` check. Plain objects with the same properties are rejected when constructing a handler.

```ts
// src/guards/threads-only.ts
import { defineGuard } from "@hyperion-js/core";

export const threadsOnly = defineGuard({
    name: "threads-only",
    description: "Use this command in a thread.",
    run: ctx => ctx.interaction.channel?.isThread() ?? false,
});
```

| Option        | Purpose                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `name`        | Identifier recorded in logs when the guard rejects an interaction.                        |
| `description` | Default ephemeral reply sent when the guard rejects.                                      |
| `run`         | Sync or async function returning `true` to allow or `false` to reject.                    |
| `onFail`      | Optional custom reply handler. See [Custom rejection replies](#custom-rejection-replies). |

By default, `defineGuard()` creates a command guard. To use a guard on buttons, select menus, modals, or all interaction types, specify the context type:

```ts fragment
// Commands only, the default
defineGuard({ name, description, run: ctx => true });

// Buttons only, via a type argument
defineGuard<ButtonContext>({ name, description, run: ctx => true });

// Select menus only
defineGuard<SelectMenuContext>({ name, description, run: ctx => true });

// Modals only, by typing the ctx parameter
defineGuard({ name, description, run: (ctx: ModalContext) => true });

// Any handler type
defineGuard<InteractionContext>({ name, description, run: ctx => true });
```

TypeScript prevents attaching a guard to an incompatible handler type.

## Parameterized guards

Wrap `defineGuard()` in a function to configure a guard per handler, such as restricting a command to one server:

```ts fragment
const allowedGuild = (guildId: string) =>
    defineGuard({
        name: "allowed-guild",
        description: "Use this command in the configured server.",
        run: ctx => ctx.interaction.guildId === guildId,
    });

guards: [allowedGuild("123456789012345678")];
```

## Storing state in a guard

Choose where to store guard state based on what needs to share it:
- **Closure inside a wrapper function** keeps in-memory state private to one guard instance.
- **Collection or `Map` passed into the wrapper** shares in-memory state across multiple handlers.
- **External storage** keeps state across bot restarts; see [SQLite key-value namespaces](sqlite.md#key-value-namespaces) and [Keeping cooldowns across restarts](persistent-cooldowns.md).

This example keeps per-user usage counts in a `Collection` from `discord.js` (a standard `Map` also works):

```ts fragment
const rateLimit = (max: number) => {
    const counts = new Collection<string, number>();

    return defineGuard({
        name: "rate-limit",
        description: "You have reached the usage limit.",
        run: ctx => {
            const used = counts.get(ctx.interaction.user.id) ?? 0;

            if (used >= max) return false;

            counts.set(ctx.interaction.user.id, used + 1);

            return true;
        },
    });
};
```

## Guard factories

A guard factory is a function in `guards` that receives the handler context and returns a guard when execution reaches that position in the array. If a check only inspects `ctx`, write it directly in `run(ctx)` rather than wrapping it in a factory. Use a factory when you need to pass values from the interaction into a parameterized guard (such as a per-user cooldown key) or select a guard asynchronously per interaction:

```ts fragment
guards: [
    ctx =>
        cooldown({
            key: `daily:${ctx.interaction.user.id}`,
            durationMs: 60_000,
            entries: cooldowns,
        }),
];
```

Factories can be async. If an earlier guard rejects, later factories are not called.

## Custom rejection replies

Add `onFail()` to send a custom response instead of the default `description` reply:

```ts fragment
export const threadsOnly = defineGuard<InteractionContext>({
    name: "threads-only",
    description: "Use this in a thread.",
    run: ctx => ctx.interaction.channel?.isThread() ?? false,
    onFail: async ctx => {
        if (!ctx.interaction.isRepliable()) return;

        await ctx.interaction.reply({
            content: "Open a thread first, then run this command there.",
            flags: MessageFlags.Ephemeral,
        });
    },
});
```

If `onFail()` throws an error, Hyperion logs the failure (`stage: "guards"`) and sends the generic error reply.

> [!WARNING]
> When `onFail()` is defined, Hyperion does not send a fallback reply for the rejection. Always respond inside `onFail()`, and check `replied` or `deferred` if an earlier guard may have acknowledged the interaction.

## Built-in guards

- **`ownerOnly`.** Allows only the Discord application owner, or the team owner for team-owned applications. Hyperion fetches and caches the owner automatically (`client.getOwnerId()` exposes the same cached lookup), and fails closed before login or if the application fetch fails.
- **`guildOnly`.** Allows the interaction only inside a server, rejecting direct messages.
- **`requirePermissions()` and `requireBotPermissions()`.** Checks that the user or bot has every listed permission in the current channel:

  ```ts fragment
  guards: [
      requirePermissions("ManageMessages"),
      requireBotPermissions("ManageMessages"),
  ];
  ```

  Both accept any discord.js `PermissionResolvable` (`"ManageMessages"`, `PermissionFlagsBits`, or bigints), pass when the member or bot has `Administrator`, and fail closed outside a server. Rejection messages are generated when the guard is created and list every requested permission, not only the missing ones (for example, `"You need the Manage Messages permission to use this."` or `"I need the Manage Messages permission here."`). For slash commands, you can also call `setDefaultMemberPermissions()` on the builder to hide the command in Discord's UI while keeping the guard for runtime enforcement.

- **`cooldown()`.** Rejects interactions while a key is on cooldown. You pass your own `Collection<string, number>` so multiple handlers can share one table. Wrap `cooldown()` in a factory to key it per user—a static key would apply a single shared cooldown to every user:

  ```ts fragment
  const cooldowns = new Collection<string, number>();

  guards: [
      ctx =>
          cooldown({
              key: `refresh:${ctx.interaction.user.id}`,
              durationMs: 5_000,
              entries: cooldowns,
          }),
  ];
  ```

  The cooldown starts as soon as the guard passes; rejected attempts do not extend expiry, while later guard or `input` failures still consume the cooldown. Because `Collection` lives in memory, cooldowns reset on restart—store them in [SQLite key-value namespaces](sqlite.md#key-value-namespaces) with a `ttl`, or follow [Keeping cooldowns across restarts](persistent-cooldowns.md).

- **`paramOwner()`.** Works on component handlers that use [custom-ID params](custom-ids.md):

  ```ts fragment
  guards: [paramOwner("owner", "Only the ticket's author can close it.")];
  ```

  Passes only when `params` pass validation and the named `string` property (enforced by TypeScript) equals `ctx.interaction.user.id`. Because `paramOwner()` trusts the ID encoded in the custom ID rather than checking current database ownership, re-check storage in `run()` for transferable or sensitive records.

## Constraints

- Hyperion does not defer before running guards, so keep guard checks fast.
- Deferring manually inside an async guard acknowledges the interaction and prevents the handler from calling `showModal()`.
- Guards run before [typed input](input.md) validation and cannot read `ctx.input`. See the [interaction pipeline](how-hyperion-works.md#interaction-pipeline).
- Autocomplete interactions skip guards. See [Autocomplete](autocomplete.md).
- If a guard throws an error, Hyperion logs it and sends a generic error reply. See [Handling errors](how-hyperion-works.md#handling-errors).
