# SQLite

`@hyperion-js/sqlite` stores bot data such as todos, member XP, or server settings in a local SQLite database and validates every row against a schema on reads and writes. It is a standalone package and works with any Node.js or discord.js bot, with or without `@hyperion-js/core`.

## Setup

Install the package alongside `better-sqlite3`:

```npm
npm install @hyperion-js/sqlite@beta better-sqlite3
```

Open a database, define your schema migrations, and create typed table helpers:

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

`migrations` runs SQL statements in order and records how many have completed, so each migration executes once per database. When you need to change a table later, append a new migration to the end of the array instead of modifying an earlier one.

Your table schema describes how each row is stored in SQLite. Empty columns return `null` rather than `undefined`, so mark nullable columns with `v.nullable()`, as with `note` above. Any synchronous [Standard Schema](https://standardschema.dev/) library works, such as Valibot or Zod.

> [!WARNING]
> Discord snowflake IDs exceed JavaScript's safe integer range. Store IDs in `TEXT` columns as strings. Binding an unsafe integer throws a `RangeError`.

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
| `get(filter)`           | Returns the first matching row, or `undefined`.                                             |
| `all(filter?)`          | Returns all matching rows, or every row when called without a filter.                       |
| `set(row)`              | Inserts the row or replaces an existing row with the same key, then returns the stored row. |
| `update(filter, patch)` | Updates the given columns on every matching row.                                            |
| `delete(filter)`        | Deletes every matching row.                                                                 |
| `deleteAll()`           | Deletes every row in the table.                                                             |

Filters match every column you specify, and `null` matches SQL `NULL`. Both `update()` and `delete()` require a non-empty filter so you cannot accidentally modify or wipe an entire table.

Every write is validated against the table schema before hitting SQLite. If validation fails, `@hyperion-js/sqlite` throws a `RowValidationError` containing the schema issues and leaves the database unchanged.

## Key-value namespaces

For simple data that does not need its own table, such as flags, guild settings, or cooldowns, use a key-value namespace:

```ts fragment
const cooldowns = db.kv("cooldowns", v.number());

if (cooldowns.has(userId)) {
    await interaction.reply("Please wait before using this again.");

    return;
}

cooldowns.set(userId, Date.now(), { ttl: 30_000 });
```

Namespaces require no migration because `@hyperion-js/sqlite` manages its own internal key-value table. The schema argument is optional; without one, values are typed as `unknown`.

| Method                      | Behavior                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| `get(key)`                  | Returns the stored value, or `undefined` if missing or expired.   |
| `set(key, value, { ttl }?)` | Stores the value. Optional `ttl` sets expiration in milliseconds. |
| `has(key)`                  | Returns `true` if the key exists and has not expired.             |
| `delete(key)`               | Removes the key.                                                  |
| `entries()`                 | Returns all non-expired `[key, value]` pairs in the namespace.    |
| `clear()`                   | Deletes every entry in the namespace.                             |

Keys must be strings. Values must be plain JSON values: objects, arrays, strings, numbers, booleans, or `null`. Non-JSON objects such as `Date` throw an error instead of silently converting to strings. Omitting `ttl` stores the key until you delete it.

## Custom SQL queries

For queries the table helpers do not cover, use the `sql` template tag:

```ts fragment
import { sql } from "@hyperion-js/sqlite";
import * as v from "valibot";

const counts = db.all(
    sql`SELECT owner, count(*) AS total FROM todos WHERE title LIKE ${pattern} GROUP BY owner`,
    v.object({ owner: v.string(), total: v.number() }),
);
```

Every interpolated `${value}` becomes a bound SQLite parameter so user input cannot alter the query. Passing a schema validates and types each returned row; omitting it returns `unknown[]`. Use ``db.run(sql`...`)`` for statements that modify rows and return change counts.

## Transactions

Wrap multiple writes in `db.transaction()` when they must succeed or fail together:

```ts fragment
db.transaction(() => {
    todos.delete({ id: from });
    todos.set({ ...todo, id: to });
});
```

If the callback throws, SQLite rolls back every write inside the transaction. Transactions are synchronous, so do not `await` inside the callback.

## Closing the database

Close the database during bot shutdown:

```ts fragment
process.once("SIGINT", async () => {
    await client.destroy();
    db.close();
});
```

## Testing

Pass `path: ":memory:"` in tests to create an isolated, empty in-memory database on each call.
