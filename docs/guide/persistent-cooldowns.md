# Keeping cooldowns across restarts

The built-in `cooldown()` guard stores timestamps in memory, so restarting your bot clears active cooldowns. Back a custom cooldown guard with `@hyperion-js/sqlite` so cooldowns survive restarts.

## Steps

1. Install `@hyperion-js/sqlite` and `better-sqlite3`:

   ```npm
   npm install @hyperion-js/sqlite@beta better-sqlite3
   ```

2. Open a database and create a key-value namespace for cooldowns:

   ```ts
   // src/database.ts
   import { createDatabase } from "@hyperion-js/sqlite";
   import * as v from "valibot";

   export const db = createDatabase({ path: "bot.db" });

   // Stores the Unix timestamp in milliseconds when each cooldown expires.
   export const cooldowns = db.kv("cooldowns", v.number());
   ```

3. Write the guard function taking a cooldown key and positive duration in milliseconds:

   ```ts fragment
   // src/guards/persistent-cooldown.ts
   import { defineGuard, type InteractionContext } from "@hyperion-js/core";
   import { cooldowns } from "../database.ts";

   export const persistentCooldown = (key: string, durationMs: number) =>
       defineGuard<InteractionContext>({
           name: "persistent-cooldown",
           description: "Please wait a moment before trying again.",
           run: () => {
               if (cooldowns.has(key)) return false;

               cooldowns.set(key, Date.now() + durationMs, { ttl: durationMs });

               return true;
           },
       });
   ```

   Passing `ttl` expires the entry automatically (`durationMs` must be positive, or `cooldowns.set()` throws `RangeError`). Because `run()` records the cooldown as soon as it passes, place cheaper checks (such as `requirePermissions()`) before `persistentCooldown` in `guards` so rejected permissions do not consume the cooldown.

4. Attach the guard to a handler using a guard factory. Keep key prefixes unique across commands sharing the `"cooldowns"` namespace, and include `ctx.interaction.guildId` when you want per-server cooldowns:

   ```ts fragment
   guards: [
       ctx => persistentCooldown(`daily:${ctx.interaction.user.id}`, 60_000),
   ],
   ```

5. Close the database when the bot shuts down (handle both `SIGINT` and `SIGTERM` for hosted bots):

   ```ts fragment
   const shutdown = async () => {
       await client.destroy();
       db.close();
   };

   process.once("SIGINT", shutdown);
   process.once("SIGTERM", shutdown);
   ```

## Verifying it works

Run the command twice in a row. The second call should return the guard's description as an ephemeral reply. Restart the bot before the 60-second window expires and run the command again: the guard should still reject the request because the timestamp is stored in `bot.db`.

> [!TIP]
> To show when the user can run the command again, read `const end = cooldowns.get(key)` inside a custom `onFail()` handler, check `end !== undefined` (the TTL can expire between `run()` and `onFail()`), and format `<t:${Math.ceil(end / 1000)}:R>` with a plain-text fallback when `end` is `undefined`. See [Custom rejection replies](guards.md#custom-rejection-replies).

For details on guards and factories, see [Guards](guards.md). For more on key-value storage, see [Key-value namespaces](sqlite.md#key-value-namespaces).
