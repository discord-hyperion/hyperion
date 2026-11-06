# Storing data

Sooner or later your bot needs to remember something: a todo list, a member's
XP, a guild's settings. `@hyperion/sqlite` keeps it in a SQLite file next to your
bot, and checks every row against a schema on the way in and out.

It's a separate package, and it works with any bot, Hyperion or not.

## Setup

Install it with the driver it runs on:

```sh
pnpm add @hyperion/sqlite better-sqlite3
```

Then open a database and describe your tables:

```ts
import { createDatabase } from "@hyperion/sqlite";
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

`migrations` is a list of steps, in order. Hyperion remembers how many have run,
so each one runs once per database. When you need a new column later, add a step
to the end of the list rather than editing an old one.

The schema describes a row as it's stored. SQLite gives back `null` for an empty
column, so make those fields nullable, like `note` above. Any
[Standard Schema](https://standardschema.dev/) library works, such as Valibot or
Zod.

## Reading and writing

```ts fragment
todos.set({ id: "1", owner: userId, title: "Write the guide", note: null });

const todo = todos.get({ id: "1" });
const mine = todos.all({ owner: userId });

todos.update({ id: "1" }, { note: "Almost done" });
todos.delete({ id: "1" });
```

`set` inserts the row, or replaces the one with the same key, and gives you back
what's stored. `get` returns one row or `undefined`. Filters match every column
you give, and `null` matches empty columns.

Every write is checked against the schema first. If it doesn't pass, you get a
`RowValidationError` with the schema's issues, and nothing is written.

`update` and `delete` need a filter, so a typo can't wipe a table. When you really
mean everything, call `todos.deleteAll()`.

## Quick values

Not everything needs a table. For settings, flags, and cooldowns, use a
key-value namespace:

```ts fragment
const cooldowns = db.kv("cooldowns", v.number());

if (cooldowns.has(userId)) {
    await interaction.reply("Slow down a little!");

    return;
}

cooldowns.set(userId, Date.now(), { ttl: 30_000 });
```

There's no migration to write: Hyperion keeps every namespace in one table of
its own. Keys are strings, and values are plain JSON, so objects, arrays,
strings, numbers, booleans, and `null`. Something JSON would change, like a
`Date`, throws instead of quietly coming back as a string.

`ttl` is how long the key lives, in milliseconds. Once it's up, the key reads as
missing. The schema is optional; without one, values come back as `unknown`.
`entries()` lists a namespace and `clear()` empties it.

## Queries

For anything the helpers don't cover, write SQL with the `sql` tag:

```ts fragment
import { sql } from "@hyperion/sqlite";
import * as v from "valibot";

const counts = db.all(
    sql`SELECT owner, count(*) AS total FROM todos WHERE title LIKE ${pattern} GROUP BY owner`,
    v.object({ owner: v.string(), total: v.number() }),
);
```

Every `${value}` becomes a bound parameter, so user input can't change the query.
Pass a schema to get typed rows back; without one, rows are `unknown`.
``db.run(sql`...`)`` runs a statement and tells you how many rows changed.

## Transactions

Wrap several writes in `db.transaction()` when they should all happen or none
should:

```ts fragment
db.transaction(() => {
    todos.delete({ id: from });
    todos.set({ ...todo, id: to });
});
```

If the function throws, every write inside it is undone. Transactions are
synchronous, so don't `await` inside one.

## Closing

Close the database when your bot shuts down:

```ts fragment
process.once("SIGINT", async () => {
    await client.destroy();
    db.close();
});
```

## Watch out

- Discord IDs are too big for JavaScript numbers. Store them as `TEXT` and keep
  them as strings; binding a number that's too big throws a `RangeError`.
- For tests, use `path: ":memory:"`: every call gets a fresh, empty database.
