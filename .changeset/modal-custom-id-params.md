---
"@hyperion/core": minor
---

Add custom-ID params for modals: `ModalHandler<Input, Params>` and `ModalContext<Input, Params>` carry `ctx.params` from the custom ID alongside `ctx.input` from the form. Params are validated before guards, input runs after them, and input resolvers see params. Every registry gains `build(definition, values)`, which copies a params handler's template with the encoded custom ID. `defineParams` now checks at compile time that `keys` names exactly the schema's input keys, and a custom ID that matches a route but cannot be decoded logs `<kind>.params.undecodable` at debug level.
