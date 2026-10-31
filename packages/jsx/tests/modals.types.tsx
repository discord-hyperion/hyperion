import type { TextInputBuilder } from "@discordjs/builders";
import { Modal, renderModal } from "../lib/index.ts";

const nativeStyle: Parameters<TextInputBuilder["setStyle"]>[0] = 2;
renderModal(
    <Modal customId="id" title="Title">
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" style={nativeStyle} />
        </Modal.Label>
    </Modal>,
);
// @ts-expect-error Modal routing IDs are explicit.
const missingId = <Modal title="Title" />;
// @ts-expect-error Text input IDs are explicit.
const missingInputId = <Modal.TextInput />;
// @ts-expect-error No numeric ID API is exposed.
const numericId = <Modal.TextInput customId="id" id={1} />;
// @ts-expect-error Style strings are restricted.
const invalidStyle = <Modal.TextInput customId="id" style="multiline" />;
// @ts-expect-error Placeholder is plain text.
const invalidPlaceholder = <Modal.TextInput customId="x" placeholder={1} />;
// @ts-expect-error Initial values are plain text.
const invalidValue = <Modal.TextInput customId="id" value={1} />;
// @ts-expect-error Text inputs are leaf controls.
const children = <Modal.TextInput customId="id" children="value" />;
// @ts-expect-error Submission schemas are outside the authoring API.
const schema = <Modal customId="id" title="Title" schema={{}} />;
void [
    missingId,
    missingInputId,
    numericId,
    invalidStyle,
    invalidPlaceholder,
    invalidValue,
    children,
    schema,
];
