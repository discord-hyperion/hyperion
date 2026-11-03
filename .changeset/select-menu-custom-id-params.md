---
"@hyperion/core": minor
---

Add custom-ID params for select menus of every type: a handler declares `componentType` and `params`, reads `ctx.params`, and is routed by its params route. Add the opt-in `ParamOwner` guard, which rejects unless the user matches a string param and the params are valid.
