# Modals

A modal is a pop-up form. You describe it with `Modal`, render it, and show it:

```tsx
import { Modal, renderModal } from "@hyperion-js/jsx";

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

Show it with `showModal(form)`. Text inputs are short and required unless you
say otherwise.

There are two kinds of custom ID here. The modal's tells your bot which form was
submitted, and each input's is the key you read that field by afterwards.

## Pre-filled forms

Want each person to see different starting values? Put the form in a function and
pass the values in as props:

```tsx
import { Modal, renderModal } from "@hyperion-js/jsx";

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

## Picking things and uploading files

Labels can hold more than text inputs. Drop in any select menu, or a file upload:

```tsx
import { Modal, renderModal, StringSelect, UserSelect } from "@hyperion-js/jsx";

const form = renderModal(
    <Modal customId="ticket.create" title="New ticket">
        <Modal.Label text="Priority">
            <StringSelect customId="priority">
                <StringSelect.Option label="Low" value="low" />
                <StringSelect.Option label="High" value="high" />
            </StringSelect>
        </Modal.Label>
        <Modal.Label text="Assign to">
            <UserSelect customId="assignee" required={false} />
        </Modal.Label>
        <Modal.Label text="Screenshots">
            <Modal.FileUpload
                customId="screenshots"
                maxValues={3}
                fileTypes={["image"]}
                required={false}
            />
        </Modal.Label>
    </Modal>,
);
```

The selects are the same ones you use in messages (see
[buttons and menus](message-components.md#select-menus)). In a form they're
required unless you pass `required={false}`, and they can't be `disabled`.
File uploads only work in modals. Limit what people can upload with
`fileTypes`: `"image"`, `"video"`, `"audio"`, or an extension like `".pdf"`.

## Good to know

- The submission arrives like any other modal submission, and you read each
  control by its custom ID. See the discord.js guide on
  [modals](https://discordjs.guide/legacy/interactions/modals).
- Each label wraps exactly one control, and custom IDs must be unique within
  the form.
- A form holds at most five labels and text displays.
- Radio buttons and checkboxes don't have JSX components yet, because the builders
  don't support them yet.
- Check permissions again when the submission comes back.

Using Hyperion? A modal handler can keep your form as its
[template](../jsx-with-hyperion.md#forms-as-templates). The
[modal reference](../../jsx-modals.md) lists every prop.

Back to the [JSX guide](../jsx.md).
