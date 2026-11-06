---
"@hyperion/core": patch
---

`HyperionClient.create()` now loads event handlers before deploying commands, so
an invalid event handler fails initialization without any deployment request.
