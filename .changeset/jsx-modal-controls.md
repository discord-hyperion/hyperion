---
"@hyperion/jsx": minor
---

Add `UserSelect`, `RoleSelect`, `MentionableSelect`, and `ChannelSelect`, and let
every select render inside a `Modal.Label` as well as an `ActionRow`. Add
`Modal.FileUpload` for modals. Selects accept `required` (ignored by Discord in
messages); `renderModal()` rejects `disabled`, which Discord doesn't allow in
modals. A label now holds any one modal control, and duplicate custom IDs are
checked across all of them.
