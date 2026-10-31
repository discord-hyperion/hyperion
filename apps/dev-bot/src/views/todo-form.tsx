import { Bold, Modal } from "@hyperion/jsx";

export const TodoForm = ({ initialName = "" }: { initialName?: string }) => (
    <Modal customId="todo.create" title="Create todo">
        <Modal.TextDisplay>
            <Bold>Todo preview</Bold> — this demo does not store submissions.
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
                required={false}
                maxLength={1_000}
            />
        </Modal.Label>
    </Modal>
);
