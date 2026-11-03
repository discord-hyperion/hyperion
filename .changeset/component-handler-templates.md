---
"@hyperion/core": minor
---

Rename the component handler classes to `ButtonHandler`, `SelectMenuHandler`, and `ModalHandler` (with `ButtonHandlerOptions`, `SelectMenuHandlerOptions`, `ModalHandlerOptions`, and `AnySelectMenuHandler`); the old names are removed. Literal handlers now declare `customId` explicitly, and every select-menu handler declares `componentType`. `builder` is an optional template on every kind: it may omit its custom ID, must match `customId` or the params route when it sets one, and select templates must match `componentType`. Add `build(customId)` to `client.buttons`, `client.selectMenus`, and `client.modals`, which returns a fresh copy of a literal handler's template with its custom ID set.
