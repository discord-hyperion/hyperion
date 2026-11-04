---
"@hyperion/core": minor
---

Modal input now extracts every modal control, not just text inputs. Selects and
checkbox groups give `string[]` (entity selects give IDs), file uploads give
`Attachment[]`, radio groups give `string | null`, and checkboxes give `boolean`.
Duplicate custom IDs across any control types are rejected.

Breaking: a form with selects, uploads, radio groups, or checkboxes now produces
extra keys, so a schema that rejects unknown keys (a strict object) fails until it
accepts them.
