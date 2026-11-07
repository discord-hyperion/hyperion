# JSX message components

`ActionRow` and `Button` describe message controls. `renderComponents()` renders
explicit action rows; `renderButton()` renders one interactive button as a core
handler template. Selects compose inside the same rows; see
[select menus](jsx-select-menus.md). Shared runtime behaviour is in
[JSX authoring](jsx.md#runtime-behaviour).

## Renderers

`renderComponents(view)` returns fresh `ActionRowBuilder[]`. The root takes only
`ActionRow`s, composed through fragments, arrays, reusable components, and
conditional children; bare buttons are never packed into rows automatically. An
empty root returns `[]`, which clears a message's controls.

`renderButton(view)` takes exactly one interactive button and returns its native
custom-ID button builder, suitable as a core `ButtonHandler` template. Link
buttons render only inside `renderComponents()`, because they cannot reach a
handler.

## Buttons

| Variant     | Required                                                                                   | Optional                            |
| ----------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Interactive | `customId`; `style`: `primary`, `secondary`, `success`, `danger`, or the native enum value | label children, `emoji`, `disabled` |
| Link        | `url` (HTTP, HTTPS, or Discord URL, checked natively)                                      | label children, `emoji`, `disabled` |
- There is no default style. A link button with `customId` or `style`, or any
  conflicting variant props, throws.
- Labels are plain-text children: literal interpolation, fragments, and reusable
  components, concatenated without separators and kept unescaped. Formatting
  components such as `Bold` throw. There is no `label` prop. An empty label omits
  the field, so emoji-only buttons work; a button with neither fails native
  validation.
- `emoji` takes the native object (`name`, `id`, `animated`); builders validate it.
- Omitted or `undefined` `disabled` leaves the field out (calling the native
  `setDisabled(undefined)` would set it to true). Explicit `false` stays `false`.
  `disabled` is presentation only: check authorization again when the click
  arrives.
- There is no numeric `id`, SKU (premium) button, or click-callback prop.

## Rows and uniqueness

- An `ActionRow` holds buttons or select menus; a select fills a row by itself,
  which native row validation enforces. Bare buttons at the root, nested rows, text
  outside buttons, `Modal.FileUpload`, prebuilt builders, and promises throw.
- Interactive custom IDs must be unique across every button and select in one
  render. A duplicate throws with both structural paths, without the ID itself.
  Separate renders may reuse IDs; nothing is generated or checked globally.
- Each row is validated with native `toJSON()`, which also validates its buttons;
  `renderButton()` validates its button once.
- Whole-message limits stay with the caller: a classic message holds five rows,
  and the renderer neither checks controls appended later nor truncates or
  repacks rows.

Native limits: labels 1–80 characters, custom IDs 1–100, and 1–5 buttons per row.
JSX does not repeat these schemas. Native validation also rejects explicit `null`
for `disabled` when validators are enabled.

## Handler template

```tsx
import { defineButton } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default defineButton({
    builder: renderButton(
        <Button customId="profile.refresh" style="primary">
            Refresh profile
        </Button>,
    ),
    async run(ctx) {
        await ctx.interaction.reply({ content: "Refresh requested." });
    },
});
```

The JSX `Button` describes the visible control; core's `ButtonHandler` handles
its clicks. Don't store per-user values on the shared template; use
`client.buttons.build()` for a fresh copy.

## Message example

```tsx
import type { CommandContext } from "@hyperion/core";
import { ActionRow, Button, renderComponents } from "@hyperion/jsx";

export const showProfileControls = async (
    ctx: CommandContext,
    refreshDisabled: boolean,
) => {
    const components = renderComponents(
        <>
            <ActionRow>
                <Button
                    customId="profile.refresh"
                    style="primary"
                    disabled={refreshDisabled}
                >
                    Refresh profile
                </Button>
            </ActionRow>
            <ActionRow>
                <Button url="https://example.com/profile">Open profile</Button>
            </ActionRow>
        </>,
    );

    await ctx.interaction.reply({ content: "Profile controls", components });
};
```

The interactive button reaches the handler above by exact custom ID; the link
button navigates without an interaction. Native collectors also work, but only
one of a collector and a handler should acknowledge a given interaction.
