# JSX modals

`Modal`, `Modal.Label`, `Modal.TextInput`, `Modal.FileUpload`, and
`Modal.TextDisplay` describe a modal form, and `renderModal()` returns a fresh
native `ModalBuilder`. Rendering builds the form only: it never opens one or
handles a submission. Read submitted values through core
[modal input](modal-input-validation.md) or native interaction getters, and see
the [core modal guide](modals.md) for opening forms and handling submissions.
Shared runtime behaviour is in [JSX authoring](jsx.md#runtime-behaviour).

## Structure

- `renderModal()` resolves exactly one `Modal` root.
- Directly under a modal: only `Modal.Label` and `Modal.TextDisplay`, after
  fragments and reusable components expand. Bare text, unlabelled controls,
  nested labels, and action rows throw.
- Each `Modal.Label` holds exactly one [modal control](#modal-controls).
- `Modal.TextDisplay` takes the [text composition](jsx.md#text-composition)
  components. Titles, label text and descriptions, placeholders, and initial values
  are plain strings.
- The modal and every control need an explicit `customId`; nothing is derived from
  labels or positions. Control custom IDs are unique within one render, across
  every control kind; a duplicate throws with both paths. Native modal validation
  doesn't check this, so the JSX check stays on even with native validators
  disabled. Separate renders may reuse IDs.
- A modal with only text displays renders if native validation accepts it; there
  is no minimum control count. An empty form fails native validation. Builder
  acceptance is not proof that Discord accepts the form.

## Components and props

| Component           | Props                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `Modal`             | Required `customId` and `title`; structural children                                                |
| `Modal.Label`       | Required plain `text`, optional plain `description`, exactly one modal control child                |
| `Modal.TextInput`   | Required `customId`; optional `style`, `required`, `placeholder`, `value`, `minLength`, `maxLength` |
| `Modal.FileUpload`  | Required `customId`; optional `minValues`, `maxValues`, `required`, `fileTypes`                     |
| `Modal.TextDisplay` | Text composition as children                                                                        |

There is no numeric component `id` prop; native builders remain available for
anything JSX doesn't expose.

## Modal controls

| Label child                                                      | Native label setter                      |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `Modal.TextInput`                                                | `setTextInputComponent()`                |
| `StringSelect`                                                   | `setStringSelectMenuComponent()`         |
| `UserSelect`, `RoleSelect`, `MentionableSelect`, `ChannelSelect` | the matching `set…SelectMenuComponent()` |
| `Modal.FileUpload`                                               | `setFileUploadComponent()`               |

The installed `@discordjs/builders` has no radio group, checkbox group, or
checkbox builders, so JSX has no components for them; core modal input still reads
their submitted values.

**Text inputs.** `style` defaults to short (native `1`); `"paragraph"` maps to `2`,
and native enum values work too. Inputs are required by default, matching
Discord's effective default; `required={false}` makes one optional and is never
replaced by the default. Empty initial values and zero minimum lengths are kept.

**Selects** are the same components used in message rows; see
[select placement](jsx-select-menus.md#placement). In a modal, `disabled` throws
(Discord rejects disabled components there), and `required` applies with a
default of `true`.

**File uploads** render a fresh native `FileUploadBuilder` and work only in
modals; message renderers throw "can only appear in a modal Label". `fileTypes`
takes `"image"`, `"video"`, `"audio"`, or a dot-prefixed extension such as
`".pdf"`, and is cloned.

A failing control reports `Modal.children[i].Label.<Control>`, where `<Control>`
drops the `Modal.` prefix (`TextInput`, `FileUpload`, `UserSelect`).

## Validation

Renderers call native `toJSON()` without an override, so they respect the global
validator setting. Native validation owns title, custom ID, content length,
component counts (at most five labels and text displays), and per-control limits:
file uploads take `minValues` 0–10 and `maxValues` 1–10, at most 10 file types,
and a `minValues` of at least 1 unless `required={false}`. JSX adds no
`minLength <= maxLength` or integer checks the native validators lack. Disabling
native validators turns those off but keeps JSX structure, plain-string metadata,
unknown-prop, and duplicate-ID checks. Errors identify structural locations and
never include form values.

## Example

```tsx
import { Bold, Modal, renderModal } from "@hyperion/jsx";

const TodoForm = ({ initialName = "" }: { initialName?: string }) => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.TextDisplay>
            <Bold>Enter your todo details.</Bold>
        </Modal.TextDisplay>
        <Modal.Label text="Name" description="A short, descriptive name">
            <Modal.TextInput
                customId="name"
                value={initialName}
                maxLength={100}
            />
        </Modal.Label>
        <Modal.Label text="Description">
            <Modal.TextInput
                customId="description"
                style="paragraph"
                placeholder="What needs doing?"
                required={false}
                maxLength={1_000}
            />
        </Modal.Label>
    </Modal>
);

const builder = renderModal(<TodoForm />);
```

Pass this builder as a core modal handler's template:
`defineModal({ builder, run })`; the handler takes the form's custom ID,
`todo.create`. Core's `defineModal` and JSX's `Modal` import together without
clashing.

To personalize a form, render a fresh one when opening it, with the same modal
custom ID; the submission still routes to the `todo.create` handler:

```tsx fragment
await ctx.interaction.showModal(
    renderModal(<TodoForm initialName={suggestedName} />),
);
```

Keep the registered template as the shared default (`client.modals.build()`
returns copies) rather than changing it per user. Showing a modal is the response,
so don't acknowledge the interaction first.

Sources: installed builders;
[Discord components reference](https://docs.discord.com/developers/components/reference),
including [text inputs](https://docs.discord.com/developers/components/reference#text-input),
[text displays](https://docs.discord.com/developers/components/reference#text-display),
and [component IDs](https://docs.discord.com/developers/components/reference#anatomy-of-a-component).
