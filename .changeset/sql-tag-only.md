---
"@hyperion/sqlite": minor
---

Queries must come from the `sql` tag. `Sql` is now exported as a type only, and `db.get()`, `db.all()`, and `db.run()` throw on a plain `{ text, values }` object, so a query can't skip parameter binding by accident. Use `db.raw` for raw SQL.
