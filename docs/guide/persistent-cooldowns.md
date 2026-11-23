# Keeping cooldowns across restarts

The built-in `cooldown()` guard stores timestamps in memory, so restarting your bot clears every active cooldown. This guide builds a cooldown guard backed by SQLite so active cooldowns persist across restarts.

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

3. Write the guard function taking a cooldown key and duration:

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

   Passing `ttl` expires the entry automatically, so you do not need manual cleanup.

4. Attach the guard to a handler using a guard factory. Include both the action name and the user ID in the key so separate commands do not share a cooldown:

   ```ts fragment
   guards: [
       ctx => persistentCooldown(`daily:${ctx.interaction.user.id}`, 60_000),
   ],
   ```

5. Close the database when the bot shuts down:

   ```ts fragment
   process.once("SIGINT", async () => {
       await client.destroy();
       db.close();
   });
   ```

## Verifying it works

Run the command twice in a row. The second call should return the guard's description as an ephemeral reply. Restart the bot before the 60-second window expires and run the command again. The guard should still reject the request because the timestamp is stored in `bot.db`.

> [!TIP]
> To show users when they can run the command again, read the stored expiration timestamp with `cooldowns.get(key)` inside a custom `onFail()` handler and format it as a Discord relative timestamp, `<t:${Math.ceil(end / 1000)}:R>`. See [Custom rejection replies](guards.md#custom-rejection-replies).

For details on guards and factories, see [Guards](guards.md). For more on key-value storage, see [Key-value namespaces](storing-data.md#key-value-namespaces).
