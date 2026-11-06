# @hyperion/sqlite

Store your bot's data in SQLite with table helpers that validate every row. It
wraps [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), works with any
bot, and doesn't depend on `@hyperion/core`.

```ts
import { createDatabase } from "@hyperion/sqlite";
import * as v from "valibot";

const db = createDatabase({
    path: "bot.db",
    migrations: [
        `CREATE TABLE todos (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL,
            title TEXT NOT NULL
        )`,
    ],
});

const todos = db.table(
    "todos",
    v.object({ id: v.string(), owner: v.string(), title: v.string() }),
    { key: "id" },
);

todos.set({ id: "1", owner: "1234567890", title: "Write the guide" });
todos.all({ owner: "1234567890" });
```

## Setup

You'll need Node.js 24.17 or newer, then install the driver beside this package:

```sh
pnpm add @hyperion/sqlite better-sqlite3
```

better-sqlite3 ships prebuilt binaries for the common platforms, so there's
nothing to compile. Any [Standard Schema](https://standardschema.dev/) library
works for rows, such as Valibot or Zod, as long as it validates synchronously.

See the [guide](https://github.com/favylicious/discord-hyperion/blob/main/docs/guide/storing-data.md)
for tables, queries, transactions, and migrations.
