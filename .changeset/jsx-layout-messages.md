---
"@hyperion/jsx": minor
---

Render layout messages (Discord's Components V2) with `renderMessage()`, which returns `{ components, flags }` with the V2 flag set (and `Ephemeral` with `{ ephemeral: true }`). Adds `Container`, `Section`, `TextDisplay`, `Thumbnail`, `MediaGallery` with `MediaGallery.Item`, and `Separator`, with placement rules and the 40-component limit checked at render time. Adds `H1`, `H2`, `H3`, and `Subtext`, usable in text displays, modal text displays, embed descriptions, and field values.
