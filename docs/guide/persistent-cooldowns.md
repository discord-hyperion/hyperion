# Keeping cooldowns across restarts

The built-in `cooldown()` guard forgets everything when your bot restarts. By
the end of this page you'll have a cooldown guard that keeps its timers in
SQLite, so a restart doesn't hand everyone a free use.

## Steps

1. Install the storage package and its driver:

   ```npm
   npm install @hyperion-js/sqlite@beta better-sqlite3
   ```

2. Open a database and give cooldowns their own namespace:

   ```ts
   // src/database.ts
   import { createDatabase } from "@hyperion-js/sqlite";
   import * as v from "valibot";

   export const db = createDatabase({ path: "bot.db" });

   // Each value is when the cooldown ends.
   export const cooldowns = db.kv("cooldowns", v.number());
   ```

3. Write the guard. It's a function that takes a key and a duration, so each
   handler picks what to rate-limit:

   ```ts fragment
   // src/guards/persistent-cooldown.ts
   import { defineGuard, type InteractionContext } from "@hyperion-js/core";
   import { cooldowns } from "../database.ts";

   export const persistentCooldown = (key: string, durationMs: number) =>
       defineGuard<InteractionContext>({
           name: "persistent-cooldown",
           description: "Slow down a little, and try again in a moment.",
           run: () => {
               if (cooldowns.has(key)) return false;

               cooldowns.set(key, Date.now() + durationMs, { ttl: durationMs });

               return true;
           },
       });
   ```

   The `ttl` makes the key expire on its own, so there's nothing to clean up.

4. Use it as a factory in any handler's `guards`, keyed by the user (and the
   command, so one cooldown doesn't block another):

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

## Check it worked

Run the command, then run it again straight away: the second try gets the
guard's description as a private reply. Restart the bot within the minute and
try once more. It's still rejected, because the cooldown lives in `bot.db`.

> [!TIP]
> Want to tell people how long is left? `cooldowns.get(key)` returns when the
> cooldown ends, so a custom `onFail()` can reply with Discord's relative time,
> `<t:${Math.ceil(end / 1000)}:R>`. See [custom rejection replies](guards.md#custom-rejection-replies).

For how guards and factories work, see [guards](guards.md). For the storage side,
see [quick values](storing-data.md#quick-values).
