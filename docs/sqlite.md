# SQLite storage

`@hyperion/sqlite` (`packages/sqlite`) is optional storage over `better-sqlite3`.
It doesn't depend on core, and core stays database-free. The design record is
[ADR 0005](adr/0005-optional-sqlite-package-on-better-sqlite3.md).

## Package

- `better-sqlite3` is a peer dependency. Version 13 ships prebuilt binaries for
  Linux (glibc and musl), macOS, and Windows on x64 and arm64, and has no install
  script, so pnpm needs no build approval.
- `@standard-schema/spec` and `@types/better-sqlite3` are dependencies, because
  the published declarations reference them.
- There is no Hyperion client integration. Apps call `db.close()` from their own
  shutdown code.

## Opening and migrations

```ts fragment
const db = createDatabase({ path: "bot.db", migrations: [first, second] });
```

`createDatabase()` opens the file (or `":memory:"`) with a 5-second busy timeout,
sets `journal_mode = WAL` and `foreign_keys = ON`, then migrates. It doesn't accept
an open `better-sqlite3` instance; `db.raw` exposes the one it opened.

`migrations` is optional and defaults to none. Each entry is a SQL string, run
with `exec`, or a `(db) => void` function receiving the Hyperion database. The
database version is `PRAGMA user_version`. Entry _n_ moves version _n_ to _n_+1;
entries below the current version are skipped. Each pending entry runs in its own
transaction together with its version bump, so a failing entry rolls back and
leaves the version where it was. A version above the array length throws. When a
migration throws, `createDatabase()` closes the connection and rethrows.
Migrations only move forward; there is no down step.

Tests use `path: ":memory:"`. Each call opens a separate empty database.

## Table helpers

```ts fragment
const todos = db.table("todos", todoSchema, { key: "id" });
```

`db.table(name, schema, { key })` reads the real columns with
`pragma_table_info`, never from the schema. It throws when:
- the table doesn't exist;
- a key column isn't a table column;
- no primary key, and no unique index without a `WHERE` clause, covers exactly
  the key columns (in any order).

`key` is one column name or a non-empty tuple, such as `["guildId", "userId"]`.
The types restrict key, filter, and patch names to the schema's output keys.

| Method                  | Returns            | Behaviour                                                      |
| ----------------------- | ------------------ | -------------------------------------------------------------- |
| `get(filter)`           | row or `undefined` | Throws when more than one row matches.                         |
| `all(filter?)`          | rows               | Every row without a filter.                                    |
| `set(row)`              | the stored row     | Validates the row, then upserts on the key with `RETURNING *`. |
| `update(filter, patch)` | rows changed       | Refuses an empty filter.                                       |
| `delete(filter)`        | rows deleted       | Refuses an empty filter.                                       |
| `deleteAll()`           | rows deleted       | The explicit form of an unfiltered delete.                     |

Filters are equality only, joined with `AND`. `null` matches `IS NULL`.
`undefined` throws a `TypeError`, so a missing variable can't widen a filter.
A column not in the table throws. Every identifier is checked against the real
columns, then double-quoted.

Rows:
- The schema describes rows as stored: SQLite returns `null` for a `NULL` column,
  so nullable columns need a nullable schema (`v.nullable(...)`).
- Reads parse every returned row.
- `set` validates the whole row and writes its defined values. Omitted and
  `undefined` properties aren't written, so the insert uses column defaults and
  the conflict update leaves them unchanged. Every written column, including the
  key, is assigned from `excluded` on conflict.
- `update` drops `undefined` patch values and returns `0` for an empty patch.
  In one transaction it reads the matching rows, merges the patch into each,
  validates the merged row, and writes the patched columns, matching the row's
  original key with `IS`. Any failure rolls the whole update back.
- A failed validation throws `RowValidationError`, whose `issues` are the
  schema's, and writes nothing. Its message names the row (`A "todos" row`).
- Schemas must validate synchronously; a schema that returns a promise throws a
  `TypeError`. Transforms that change a value's type aren't supported.

## Key-value namespaces

```ts fragment
const cooldowns = db.kv("cooldowns", v.number());
```

`db.kv(namespace, schema?)` returns a store for one namespace of the internal
table `_hyperion_kv (namespace TEXT, key TEXT, value TEXT, expires INTEGER)`,
keyed on `(namespace, key)`. The first `kv()` call on a database creates the
table with `CREATE TABLE IF NOT EXISTS`, outside the app's migrations; it doesn't
change `user_version`. The layout is fixed. See
[ADR 0007](adr/0007-key-value-namespaces-on-the-sqlite-package.md).

| Method                      | Returns                                           |
| --------------------------- | ------------------------------------------------- |
| `get(key)`                  | the value, or `undefined` when missing or expired |
| `set(key, value, { ttl }?)` | the stored value                                  |
| `has(key)`                  | whether the key exists and hasn't expired         |
| `delete(key)`               | whether an unexpired key was deleted              |
| `entries()`                 | every unexpired `[key, value]`, ordered by key    |
| `clear()`                   | how many unexpired keys were deleted              |
- Namespaces and keys are strings, including `""`; anything else throws a
  `TypeError`. Two stores on the same namespace share its keys.
- With a schema, `set` validates the value and stores the schema's output, and
  `get` and `entries` validate each stored value. A failure throws
  `RowValidationError` naming the namespace and key
  (`The "counts" value for "u1"`). Without a schema, values are typed `unknown`.
  `has` and `delete` don't validate.
- Values are stored with `JSON.stringify` and must come back unchanged. `set`
  throws a `TypeError` naming the path for `undefined` (including in an object
  property), non-finite numbers, `bigint`, functions, symbols, empty array slots,
  and objects whose prototype isn't `Object.prototype` or `null`, such as `Date`,
  `Map`, and `Set`. Nothing is written.
- `ttl` is milliseconds. It must be a positive number whose expiry,
  `ceil(Date.now() + ttl)`, is a safe integer; otherwise `set` throws a
  `RangeError` and writes nothing. A `set` without `ttl` stores `expires = NULL`,
  so the newest `set` decides.
- A key is expired once `Date.now()` reaches its expiry. `get`, `has`, and
  `delete` delete an expired key they read; `entries` and `clear` first delete
  every expired key in the namespace. Nothing runs in the background, so unread
  expired rows stay on disk.

## Queries

`sql` is a tagged template returning an `Sql` value (`text` with `?`
placeholders, and `values`). Every interpolated value is a bound parameter, and
interpolated values are typed `SqlValue`: `string | number | bigint | Uint8Array
| null`. Identifiers can't be interpolated. Interpolating another `Sql` throws.
- `db.get(query, schema?)`: the first row, or `undefined`.
- `db.all(query, schema?)`: every row.
- `db.run(query)`: `{ changes, lastInsertRowid }`.

With a schema, each row is parsed and typed by it; without one, rows are
`unknown`.

`db.transaction(fn)` runs `fn` in a `better-sqlite3` transaction and returns its
result: it commits on return and rolls back on throw. It is synchronous only; a
function returning a promise throws. Nested calls use savepoints.

## Safety

Binding a number that is an integer but not a safe integer throws a
`RangeError`. Table helpers name the column (`"users"."id"`); `sql` names the
parameter position. Store Discord IDs as `TEXT`, or bind a `bigint`. Reads use
`better-sqlite3` defaults, so `INTEGER` values come back as numbers.

Prepared statements are cached per database by SQL text.

## Not in v1

Client integration (close on shutdown, logging), slow-query logging, typed
constraint errors, and date and JSON column helpers.
