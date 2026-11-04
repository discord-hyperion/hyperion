---
"@hyperion/jsx": patch
---

Clearer render errors: a failing application component is named in the message,
and a component passed as a child instead of rendered (`{Card}` for `<Card />`)
gets its own message.
