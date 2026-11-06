# Key-value namespaces on the SQLite package

`@hyperion/sqlite` adds `db.kv(namespace, schema?)`: string keys, plain JSON
values, and optional expiry, stored in one table the package creates itself,
`_hyperion_kv (namespace, key, value, expires)`. It sits beside the table
helpers instead of replacing them, because bot data that needs filtering or
sorting needs real columns, while settings, flags, and cooldowns don't need a
migration. ADR 0005 had deferred a key-value store as "later".
- **Fixed internal table.** It is created with `CREATE TABLE IF NOT EXISTS` on
  first use, outside the app's migrations and `user_version`. This is the only
  schema the package owns, so its layout can't change without a migration path.
- **Plain JSON only.** A value that wouldn't come back from JSON unchanged
  (`Date`, `Map`, `Set`, `bigint`, `undefined`, non-finite numbers, class
  instances) throws. Encoding those types, as CommandKit does, was rejected as a
  serialization format to support forever; plain `JSON.stringify` was rejected
  because a `Date` would silently come back as a string.
- **Expiry on read.** Expired keys read as missing and are deleted when a read
  finds them. There is no timer or background sweep, so expired rows stay on
  disk until read, and no clock option; tests mock `Date`.
- **Synchronous**, like the rest of the package, unlike Keyv and CommandKit.
