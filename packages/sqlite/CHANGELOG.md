# @hyperion-js/sqlite

## 0.2.0

### Minor Changes

- 22757ee: Queries must come from the `sql` tag. `Sql` is now exported as a type only, and `db.get()`, `db.all()`, and `db.run()` throw on a plain `{ text, values }` object, so a query can't skip parameter binding by accident. Use `db.raw` for raw SQL.

## 0.1.0

### Minor Changes

- c72c3e3: Add `db.kv(namespace, schema?)`: key-value namespaces with string keys, plain
  JSON values, and optional expiry through `set(key, value, { ttl })`, stored in a
  table the package creates on first use.
- b88f54c: Introduce `@hyperion/sqlite`, optional SQLite storage over `better-sqlite3`:
  `createDatabase()` with migrations, `db.table()` helpers that validate rows with
  a Standard Schema, `sql` tagged queries with bound parameters, and synchronous
  transactions. It doesn't depend on `@hyperion/core`.
