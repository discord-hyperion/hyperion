# Guards

A guard is a check that runs before a handler executes. Return `true` to allow the interaction or `false` to reject it. Use guards for checks such as ownership, permissions, and rate limits instead of repeating that logic in every `run()` method.

## Using a guard

Commands, buttons, select menus, and modals all accept a `guards` array:

```ts fragment
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

Guards run in array order. When a guard returns `false`, Hyperion stops the remaining guards and skips `run()`. By default, Hyperion sends the guard's `description` to the user as an ephemeral reply.

Guards apply only to the handler they are attached to. A command's guards do not protect buttons, menus, or modals sent by that command, so attach guards to those component handlers as well.

## Writing a custom guard

Create a guard with `defineGuard()`, supplying a `name`, a `description`, and a `run()` check:

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

By default, `defineGuard()` creates a command guard. To use a guard on buttons, modals, select menus, or all interaction types, specify the context type:

```ts fragment
// Commands only, the default
defineGuard({ name, description, run: ctx => true });

// Buttons only, via a type argument
defineGuard<ButtonContext>({ name, description, run: ctx => true });

// Modals only, by typing the ctx parameter
defineGuard({ name, description, run: (ctx: ModalContext) => true });

// Any handler type
defineGuard<InteractionContext>({ name, description, run: ctx => true });
```

TypeScript prevents you from attaching a guard to an incompatible handler type.

## Parameterized guards

To pass configuration into a guard, such as an allowed server ID, wrap `defineGuard()` in a function:

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

Use a closure inside the wrapper function to keep in-memory state for a guard:

```ts fragment
const rateLimit = (max: number) => {
    const counts = new Collection<string, number>();

    return defineGuard({
        name: "rate-limit",
        description: "You have reached the usage limit.",
        run: ctx => {
            const used = counts.get(ctx.interaction.user.id) ?? 0;
            counts.set(ctx.interaction.user.id, used + 1);

            return used < max;
        },
    });
};
```

To share state across multiple guards, create the collection outside the wrapper and pass it in. To construct a guard dynamically for each interaction, use a guard factory.

## Guard factories

You can pass a function in the `guards` array that returns a guard. Hyperion calls the factory with the handler context each time an interaction reaches that position in the array:

```ts fragment
guards: [ctx => accessCheck(ctx.interaction.user.id)];
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

> [!WARNING]
> When `onFail()` is defined, Hyperion does not send a fallback reply for the rejection. Always respond inside `onFail()`, and check `replied` or `deferred` if an earlier guard may have acknowledged the interaction.

## Built-in guards

- **`ownerOnly`.** Allows only the Discord application owner, or the team owner for team-owned applications. Hyperion fetches and caches the owner from Discord automatically.
- **`guildOnly`.** Allows the interaction only inside a server, rejecting direct messages.
- **`requirePermissions()` and `requireBotPermissions()`.** Checks that the user or the bot has every listed permission in the current channel:

  ```ts fragment
  guards: [
      requirePermissions("ManageMessages"),
      requireBotPermissions("ManageMessages"),
  ];
  ```

  When rejected, the default reply lists the missing permissions, such as "You need the Manage Messages permission to use this." For slash commands, you can also call `setDefaultMemberPermissions()` on the builder to hide the command in Discord's UI. Use the guard as well for buttons, menus, and runtime enforcement.

- **`cooldown()`.** Rejects interactions while a key is on cooldown. You pass your own `Collection<string, number>`, so multiple handlers can share a single cooldown table. Wrap `cooldown()` in a factory to key it per user:

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

  The cooldown starts as soon as the guard passes, even if the handler fails afterward. Because `Collection` is stored in memory, cooldowns reset when the bot restarts. For cooldowns that persist across restarts, store them in [SQLite key-value namespaces](storing-data.md#key-value-namespaces) with a `ttl`, or follow [Keeping cooldowns across restarts](persistent-cooldowns.md).

- **`paramOwner()`.** Works on handlers that use [custom ID params](custom-ids.md). Passes only when the params pass validation and the specified key matches `ctx.interaction.user.id`. Pass an optional second argument to customize the rejection message.

## Constraints

- Hyperion does not defer before running guards, so keep guard checks fast.
- Guards run before [typed input](input.md) validation and cannot read `ctx.input`.
- Autocomplete interactions skip guards. See [Autocomplete](autocomplete.md).
- If a guard throws an error, Hyperion logs it and sends a generic error message. See [Responding](responding.md).
