---
"@hyperion/jsx": minor
---

Add `renderUserSelect()`, `renderRoleSelect()`, `renderMentionableSelect()`, and
`renderChannelSelect()`, so entity-select handlers can keep a JSX template the way
`renderStringSelect()` does. Each returns its own native builder and rejects any
other root, including a different select kind.
