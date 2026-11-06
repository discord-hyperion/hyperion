---
"@hyperion/core": patch
---

`destroy()` now removes the interaction dispatcher's listener, and
`InteractionDispatcher` gains `detach()`; `attach()` no longer adds a second
listener when called twice.
