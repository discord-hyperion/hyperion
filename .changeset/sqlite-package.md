---
"@hyperion/sqlite": minor
---

Introduce `@hyperion/sqlite`, optional SQLite storage over `better-sqlite3`:
`createDatabase()` with migrations, `db.table()` helpers that validate rows with
a Standard Schema, `sql` tagged queries with bound parameters, and synchronous
transactions. It doesn't depend on `@hyperion/core`.
