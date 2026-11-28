# Modals

Describe a Discord modal form with `<Modal>` and render it into a `ModalBuilder` with `renderModal()`:

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

Show the modal with `await interaction.showModal(form)`. Because `showModal()` is the interaction response, never reply or defer before calling it. By default, `<Modal.TextInput>` uses `style="short"` and `required={true}`.

`<Modal>` `customId` identifies which form was submitted, while each modal control's `customId` identifies the key you read from the submission. `<Modal.TextDisplay>` supports the same rich formatting components as [embeds](embeds.md#formatting-text) (including headings), whereas `Modal` `title`, `Modal.Label` `text` and `description`, and `Modal.TextInput` `placeholder` and `value` are plain unescaped strings.

## Pre-filled forms

Define a function component that accepts props to pre-fill starting values per user:

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

Each call to `renderModal()` builds a fresh `ModalBuilder`, so one user's pre-filled values never carry over to another user's form. Fetch dynamic defaults before rendering and pass them in as props.

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

Modals accept the same select components used in messages (see [Select menus](message-components.md#select-menus)). Inside a modal, select menus are required by default unless you pass `required={false}`, and they cannot be `disabled`.

`<Modal.FileUpload>` works only inside modals. Restrict allowed files with `fileTypes`, using `"image"`, `"video"`, `"audio"`, or file extensions such as `".pdf"`. `minValues` (`0`–`10`) must be at least `1` unless `required={false}`, and `maxValues` is `1`–`10`.

## Rules and limits

- Handle modal submissions with `@hyperion-js/core`'s [Modals](../modals.md) handler and typed input, or directly via discord.js (see the discord.js guide on [modals](https://discordjs.guide/legacy/interactions/modals)).
- Each `<Modal.Label>` wraps one modal control. `@hyperion-js/jsx` enforces unique modal-control `customId` values across all control kinds within a form even though native builders do not.
- A modal holds at most five top-level labels and text displays combined.
- Radio groups and checkboxes do not have JSX components yet because `@discordjs/builders` does not expose builders for them yet.
- Re-check permissions when handling the modal submission.

If you use `@hyperion-js/core`, a modal handler can store your JSX form as its [template](with-hyperion.md#forms-as-templates), or return to the [JSX guide](../jsx.md).
