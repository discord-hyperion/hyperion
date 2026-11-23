# Modals

A modal is a pop-up form triggered by an interaction. Describe the form with `<Modal>` and render it into a `ModalBuilder` with `renderModal()`:

```tsx
import { Modal, renderModal } from "@hyperion-js/jsx";

const form = renderModal(
    <Modal customId="todo.create" title="Create todo">
        <Modal.TextDisplay>
            Enter the details for the new todo.
        </Modal.TextDisplay>
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

Display the modal with `await interaction.showModal(form)`. By default, `<Modal.TextInput>` uses `style="short"` and `required={true}`.

Notice the two roles of `customId`. The `<Modal>` `customId` identifies which form was submitted, while each input's `customId` identifies the field key you read from the submission.

## Pre-filled forms

To pre-fill starting values per user, define a function component and pass the values as props:

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

Each call to `renderModal()` builds a fresh `ModalBuilder`, so one user's pre-filled values never carry over to another user's form. Fetch any dynamic defaults before rendering and pass them in as props.

## Select menus and file uploads

`<Modal.Label>` can wrap a text input, any select menu component, or `<Modal.FileUpload>`:

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

Modals accept the same select components used in messages. See [Select menus](message-components.md#select-menus). Inside a modal, select menus are required by default unless you pass `required={false}`, and they cannot be `disabled`.

`<Modal.FileUpload>` works only inside modals. Restrict allowed files with `fileTypes`, using `"image"`, `"video"`, `"audio"`, or file extensions such as `".pdf"`.

## Rules and limits

- Handle the submitted form like any other discord.js modal submission, reading each control by its `customId`. See the discord.js guide on [modals](https://discordjs.guide/legacy/interactions/modals).
- Each `<Modal.Label>` wraps one control, and all control `customId` values must be unique within the form.
- A modal holds at most five top-level labels and text displays combined.
- Radio groups and checkboxes do not have JSX components yet because `@discordjs/builders` does not expose builders for them yet.
- Re-check permissions when handling the modal submission.

If you use `@hyperion-js/core`, a modal handler can store your JSX form as its [template](../jsx-with-hyperion.md#forms-as-templates). For all modal props and constraints, see the [JSX modals reference](../../jsx-modals.md), or return to the [JSX guide](../jsx.md).
