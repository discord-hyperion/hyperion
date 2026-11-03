---
"@hyperion/core": patch
---

When the generic error response cannot edit a deferred reply, such as one already edited into a layout message, send an ephemeral follow-up instead and log `<kind>.error-response.fallback` at debug level.
