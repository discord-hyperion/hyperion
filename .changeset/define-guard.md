---
"@hyperion/core": minor
---

Define guards with `defineGuard({ name, description, run, onFail? })` instead of extending a class. `Guard<Context>` is now a type, and only values returned by `defineGuard()` are accepted as guards; the context type comes from a generic, an annotated `run` parameter, or defaults to `CommandContext`. Built-in guards change to `ownerOnly` (was `new OwnerOnly()`), `cooldown({...})` (was `new Cooldown({...})`), and `paramOwner(key, description?)` (was `new ParamOwner(...)`). `GuardOptions` is replaced by `GuardDefinition`.
