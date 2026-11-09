# @hyperion-js/jsx

## 1.0.0-beta.0

### Major Changes

- bd6cb67: Publish under the `@hyperion-js` npm scope. Replace `@hyperion/core`, `@hyperion/jsx`, and `@hyperion/sqlite` imports and dependencies with `@hyperion-js/core`, `@hyperion-js/jsx`, and `@hyperion-js/sqlite`. This is the first release toward 1.0, which ships once discord.js v15 is stable.

## 0.3.0

### Minor Changes

- 7c7e1aa: Add `renderUserSelect()`, `renderRoleSelect()`, `renderMentionableSelect()`, and
  `renderChannelSelect()`, so entity-select handlers can keep a JSX template the way
  `renderStringSelect()` does. Each returns its own native builder and rejects any
  other root, including a different select kind.

## 0.2.0

### Minor Changes

- 249205b: Add `UserSelect`, `RoleSelect`, `MentionableSelect`, and `ChannelSelect`, and let
  every select render inside a `Modal.Label` as well as an `ActionRow`. Add
  `Modal.FileUpload` for modals. Selects accept `required` (ignored by Discord in
  messages); `renderModal()` rejects `disabled`, which Discord doesn't allow in
  modals. A label now holds any one modal control, and duplicate custom IDs are
  checked across all of them.

## 0.1.0

### Minor Changes

- 7bd69d7: Introduce the independent @hyperion/jsx package for synchronous embed authoring,
  escaped text composition, reusable components, and native EmbedBuilder output.
- fb98140: Render layout messages (Discord's Components V2) with `renderMessage()`, which returns `{ components, flags }` with the V2 flag set (and `Ephemeral` with `{ ephemeral: true }`). Adds `Container`, `Section`, `TextDisplay`, `Thumbnail`, `MediaGallery` with `MediaGallery.Item`, and `Separator`, with placement rules and the 40-component limit checked at render time. Adds `H1`, `H2`, `H3`, and `Subtext`, usable in text displays, modal text displays, embed descriptions, and field values.
- bf7da68: Add JSX action rows, interactive buttons, and link buttons with renderComponents
  and renderButton. Return fresh native builders, preserve literal labels, support
  native emoji objects and explicit styles, and check JSX structure and duplicate
  custom IDs without changing interaction routing or collectors.
- 734db6d: Add JSX modal authoring with labels, text inputs, informational text displays,
  style conveniences, explicit input IDs, duplicate-ID checks, and fresh native
  ModalBuilder output. Reuse existing modal handlers for personalized form values
  without mutating shared definitions.
- 5d7c477: Add JSX message string selects with namespaced option children and a standalone
  renderStringSelect renderer returning native builders. Extend action-row rendering
  and duplicate-ID checks across buttons and selects, preserve native defaults and
  validation, and reject duplicate option values without changing core routing.

### Patch Changes

- 04533cb: Clearer render errors: a failing application component is named in the message,
  and a component passed as a child instead of rendered (`{Card}` for `<Card />`)
  gets its own message.
