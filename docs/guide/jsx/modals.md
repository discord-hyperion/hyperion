# Modals

A modal is a pop-up form. You describe it with `Modal`, render it, and show it:

```tsx
import { Modal, renderModal } from "@hyperion/jsx";

const form = renderModal(
    <Modal customId="todo.create" title="Create todo">
        <Modal.TextDisplay>Tell us what needs doing.</Modal.TextDisplay>
        <Modal.Label text="Name" description="A short, descriptive name">
            <Modal.TextInput customId="name" maxLength={100} />
        </Modal.Label>
        <Modal.Label text="Description">
            <Modal.TextInput
                customId="description"
                style="paragraph"
                required={false}
            />
        </Modal.Label>
    </Modal>,
);
```

Call `await interaction.showModal(form)` from the command or component handler
that opens it. In discord.js v15, every text input sits inside a label, and
inputs are short and required unless you say otherwise.

There are two kinds of custom ID here. The modal's `customId` tells your bot
which form was submitted. Each input's `customId` is the key you use to read that
field afterwards.

## Pre-filled forms

Want each person to see different starting values? Put the form in a function and
pass the values in as props:

```tsx
import { Modal, renderModal } from "@hyperion/jsx";

type TodoFormProps = { initialName?: string };

const TodoForm = ({ initialName = "" }: TodoFormProps) => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.Label text="Name">
            <Modal.TextInput
                customId="name"
                value={initialName}
                maxLength={100}
            />
        </Modal.Label>
    </Modal>
);

const form = renderModal(<TodoForm initialName="Review the change" />);
```

Every render builds a new form, so one person's values can't leak into another's
form. Fetch any suggestions first, then pass them in.

## Handling the submission

The submission comes back as a separate interaction. Listen for it in your
`interactionCreate` handler, or call `awaitModalSubmit()` on the interaction that
opened the form. Either way, read a field with
`interaction.components.getTextInputValue("name")`, using the input's custom ID.

## Good to know

- Showing a modal is itself the response, so don't reply or defer first.
- Each label wraps exactly one text input, and input IDs must be unique within
  the form.
- JSX covers text inputs and text displays. For other controls, use the native
  builders.
- The submission is a separate interaction from the one that opened the form, so
  check permissions again when it comes back.

Using Hyperion? A modal handler can keep your form as its
[template](../jsx-with-hyperion.md#forms-as-templates). The
[modal reference](../../jsx-modals.md) lists every prop.

Back to the [JSX guide](../jsx.md).
