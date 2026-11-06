---
"@hyperion/core": minor
---

Button, select-menu, and modal handlers with a template now take its custom ID as
theirs, so the ID is written once.

**Breaking:** passing `customId` beside `builder` is a type error and throws.
Delete `customId` and keep the template's ID. A template must carry a custom ID,
and a params handler's template must carry the params route
(`.setCustomId(definition.id)`).
