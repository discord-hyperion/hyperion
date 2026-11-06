---
"@hyperion/core": patch
---

`defineParams()` rejects a `__proto__` key, which decoding silently dropped.
