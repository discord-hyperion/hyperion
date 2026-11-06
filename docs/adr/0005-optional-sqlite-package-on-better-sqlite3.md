---
status: accepted
---

# Optional SQLite package on better-sqlite3

Core stays database-free. Storage ships as a separate, optional package,
`@hyperion/sqlite`, that doesn't depend on core, like `@hyperion/jsx`. It wraps
`better-sqlite3` with table helpers over real rows. The contract lives in
[SQLite storage](../sqlite.md).

## Considered options

- **Driver.** `node:sqlite` needs no install and ships with Node 24, but it is
  still a release candidate. `better-sqlite3` was chosen as the mature driver,
  accepting a native addon and pnpm's build approval.
- **Key-value store.** A quick.db or Keyv style `get("key")` store was rejected
  for v1: Keyv already covers it, and `@keyv/sqlite` runs on `better-sqlite3`.
  Table helpers filter on real columns, which a key-value store can't.
- **Name.** `kv` was rejected because it promises a key-value store.

## Decisions

Packaging:
- `better-sqlite3` is a peer dependency. Version 13 ships prebuilt binaries
  without an install script, so the `pnpm approve-builds` step this record first
  expected isn't needed.
- No integration with the Hyperion client in v1. Apps call `db.close()` from
  their own shutdown code.

Opening and migrations:
- `createDatabase({ path, migrations })` opens the database itself, enables WAL,
  `foreign_keys`, and a busy timeout, then runs migrations. It doesn't accept an
  already open instance; `db.raw` exposes the `better-sqlite3` instance.
- Migrations are an in-code array tracked by `user_version`. Entry _n_ moves the
  database to version _n_+1. Each entry is a SQL string or a `(db) => void`
  function and runs in its own transaction. Forward only. A database version
  newer than the array throws.
- Tests use `path: ":memory:"`; there is no separate test helper.

Table helpers:

```ts
const todos = db.table("todos", todoSchema, { key: "id" });

todos.get({ id }); // row | undefined; throws if several match
todos.all({ owner }); // row[]
todos.set(row); // upsert on the key; returns the stored row
todos.update({ owner }, patch); // returns the number of rows changed
todos.delete({ id }); // returns the number of rows deleted
todos.deleteAll(); // returns the number of rows deleted
```

- `db.table()` reads columns with `PRAGMA table_info`, never from the schema,
  because Standard Schema doesn't expose fields. A missing table, a missing key
  column, or a key without a matching primary key or unique constraint throws
  when `table()` is called.
- `key` is one column or several, such as `["guildId", "userId"]`.
- Filters are equality only, joined with AND. `null` matches `IS NULL`. An
  unknown column throws. Identifiers are checked against the real columns and
  quoted. `update` and `delete` refuse an empty filter; `deleteAll()` is the
  explicit form.
- The schema describes rows as stored. Reads parse every row. `set` validates the
  whole row. `update` reads the matching rows, merges the patch, validates each
  row, and writes, all in one transaction. A failed write validation throws with
  the schema's issues and writes nothing. Transforms that change a value's type
  aren't supported.

Queries and safety:
- `db.get`, `db.all`, and `db.run` take a `sql` tagged template. Every
  interpolated value is a bound parameter, and identifiers can't be
  interpolated. The schema argument is optional; without it rows are `unknown`.
  `run` returns `{ changes, lastInsertRowid }`.
- `db.transaction(fn)` is synchronous only.
- Binding a number that isn't a safe integer throws a `RangeError` naming the
  column. The docs tell users to store Discord IDs as `TEXT`.
- Prepared statements are cached internally.

## Consequences

- Delivery moves dev-bot's todo list to SQLite with `:memory:` tests, adds
  `docs/sqlite.md`, a "Storing data" guide page, a changeset, and a
  packed-consumer fixture for `verify:package`. AGENTS.md and the feature list
  then say core stays database-free and point here.
- Later, not v1: client integration (close on shutdown, logging), slow-query
  logging, typed constraint errors, date and JSON column helpers, and a
  key-value store.
