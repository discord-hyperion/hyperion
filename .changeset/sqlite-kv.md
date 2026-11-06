---
"@hyperion/sqlite": minor
---

Add `db.kv(namespace, schema?)`: key-value namespaces with string keys, plain
JSON values, and optional expiry through `set(key, value, { ttl })`, stored in a
table the package creates on first use.
