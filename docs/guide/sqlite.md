# SQLite

`@hyperion-js/sqlite` stores bot data such as todos, member XP, or server settings in a local SQLite database with schema-validated tables and key-value namespaces. It works standalone in any Node.js 24.17+ or discord.js app, with or without `@hyperion-js/core`.

## Setup

Install `@hyperion-js/sqlite` alongside `better-sqlite3` (`better-sqlite3` v13 ships prebuilt binaries, so no native compiler toolchain is needed on standard platforms):

```npm
npm install @hyperion-js/sqlite@beta better-sqlite3
```

Open a database, define migrations, and create typed table helpers:

```ts
// src/database.ts
import { createDatabase } from "@hyperion-js/sqlite";
import * as v from "valibot";

export const db = createDatabase({
    path: "bot.db",
    migrations: [
        `CREATE TABLE todos (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL,
            title TEXT NOT NULL,
            note TEXT
        )`,
    ],
});

export const todos = db.table(
    "todos",
    v.object({
        id: v.string(),
        owner: v.string(),
        title: v.pipe(v.string(), v.minLength(1)),
        note: v.nullable(v.string()),
    }),
    { key: "id" },
);
```

`createDatabase()` configures `journal_mode = WAL`, `foreign_keys = ON`, and a 5-second busy timeout automatically. `migrations` accepts SQL strings or `(db) => void` functions (for data migrations), runs each unapplied entry in its own transaction (rolling back and closing the database on error), and tracks progress in SQLite's `user_version`. Migrations are forward-only: append new entries rather than editing or removing applied ones, because removing an applied migration throws at startup.

`db.table()` supports single or composite keys (`{ key: ["guildId", "userId"] }`) and verifies at startup that the table exists with a primary key or full unique index matching `key`. Empty SQLite columns return `null` rather than `undefined`, so mark nullable columns with `v.nullable()`. Any **synchronous** [Standard Schema](https://standardschema.dev/) library works (async schemas throw `TypeError`), and schema transforms that change a value's type are not supported.

> [!WARNING]
> Discord snowflake IDs exceed JavaScript's safe integer range. Store IDs in `TEXT` columns as strings; binding an unsafe integer throws `RangeError`.

## Reading and writing rows

```ts fragment
todos.set({ id: "1", owner: userId, title: "Write the guide", note: null });

const todo = todos.get({ id: "1" });
const mine = todos.all({ owner: userId });

todos.update({ id: "1" }, { note: "Almost done" });
todos.delete({ id: "1" });
```

| Method                  | Behavior                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `get(filter)`           | Returns the single matching row, or `undefined`. Throws if more than one row matches.       |
| `all(filter?)`          | Returns all matching rows, or every row when called without a filter.                       |
| `set(row)`              | Inserts the row or replaces an existing row with the same key, then returns the stored row. |
| `update(filter, patch)` | Updates matching rows and returns the number of rows changed.                               |
| `delete(filter)`        | Deletes matching rows and returns the number of rows deleted.                               |
| `deleteAll()`           | Deletes every row in the table and returns the number of rows deleted.                      |

Use `all(filter)` or ``db.get(sql`...`)`` when more than one row may match. Filters match every column you specify, and `null` matches SQL `NULL`; passing `undefined` in a filter throws `TypeError` so an unset variable cannot accidentally widen a query. Both `update()` and `delete()` require a non-empty filter.

`set()` omits `undefined` properties so SQLite column defaults apply on insert and conflict updates leave those columns unchanged. Validation runs on both reads and writes: `update()` reads matching rows, merges the patch, validates every merged row, and rolls back the transaction with `RowValidationError` if any row fails.

## Key-value namespaces

For simple data that does not need its own table—such as flags, server settings, or cooldowns—use a key-value namespace:

```ts fragment
const cooldowns = db.kv("cooldowns", v.number());

if (cooldowns.has(userId)) {
    await interaction.reply("Please wait before using this again.");

    return;
}

cooldowns.set(userId, Date.now(), { ttl: 30_000 });
```

Namespaces need no migration because `@hyperion-js/sqlite` manages its own internal key-value table. The schema argument is optional; without one, values are typed as `unknown`.

| Method                      | Behavior                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `get(key)`                  | Returns the stored value, or `undefined` if missing or expired.                        |
| `set(key, value, { ttl }?)` | Stores and returns the value. Optional `ttl` sets expiration in milliseconds.          |
| `has(key)`                  | Returns `true` if the key exists and has not expired.                                  |
| `delete(key)`               | Removes the key and returns `true` if an unexpired key was deleted.                    |
| `entries()`                 | Returns all non-expired `[key, value]` pairs ordered by key.                           |
| `clear()`                   | Deletes every entry in the namespace and returns the number of unexpired keys removed. |

Keys must be strings. `ttl` must be a positive finite number of milliseconds (`RangeError` otherwise), and calling `set()` without `ttl` removes any earlier expiry. Expiration is checked lazily on read (`get`, `has`, `delete`, `entries`, `clear`) with no background timer, so unread expired rows remain on disk until touched or swept by `entries()` or `clear()`.

`set()`, `get()`, and `entries()` validate against the optional schema (`RowValidationError`), while `has()` and `delete()` do not. Values must be plain JSON data: `undefined` (even inside objects), `NaN`/`Infinity`, `bigint`, and class instances such as `Date`, `Map`, or `Set` throw `TypeError`.

## Custom SQL queries

Use the `sql` template tag for queries the table helpers do not cover:

```ts fragment
import { sql } from "@hyperion-js/sqlite";
import * as v from "valibot";

const counts = db.all(
    sql`SELECT owner, count(*) AS total FROM todos WHERE title LIKE ${pattern} GROUP BY owner`,
    v.object({ owner: v.string(), total: v.number() }),
);
```

Every `${value}` interpolation becomes a bound SQLite parameter so user input cannot alter the SQL. Passing a schema validates and types each returned row; omitting it returns `unknown` / `unknown[]`. Use ``db.get(sql`...`, schema?)`` to return the first matching row or `undefined` without throwing on multiple rows, and ``db.run(sql`...`)`` for statements that return `{ changes, lastInsertRowid }`.

Table and column identifiers cannot be interpolated with `${...}`, and `sql` queries cannot be nested. For features outside these helpers, `db.raw` exposes the underlying `better-sqlite3` database instance.

## Transactions

Wrap multiple writes in `db.transaction()` when they must succeed or fail together:

```ts fragment
db.transaction(() => {
    todos.delete({ id: from });
    todos.set({ ...todo, id: to });
});
```

`db.transaction()` returns the callback's return value, rolls back all writes if the callback throws, and supports nested transactions via SQLite savepoints. Transactions are synchronous—returning a `Promise` throws an error.

## Closing the database

`@hyperion-js/sqlite` does not hook into `HyperionClient` shutdown automatically. Close `db` after `await client.destroy()` on `SIGINT` and `SIGTERM`:

```ts fragment
const shutdown = async () => {
    await client.destroy();
    db.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
```

## Testing

Pass `path: ":memory:"` with your `migrations` array to create an isolated in-memory database per test, and call `db.close()` during test cleanup:

```ts fragment
const db = createDatabase({ path: ":memory:", migrations });
// ...run assertions...
db.close();
```

For full behavior and error contracts, see the [SQLite storage reference](../sqlite.md).
