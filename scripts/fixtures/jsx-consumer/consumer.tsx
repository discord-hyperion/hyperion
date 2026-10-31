import type { EmbedBuilder, ModalBuilder } from "@discordjs/builders";
import {
    Bold,
    type Component,
    Embed,
    Modal,
    renderEmbed,
    renderModal,
} from "@hyperion/jsx";

const View: Component<{ name: string }> = ({ name }) => (
    <Embed>
        <Embed.Title>{name}</Embed.Title>
        <Embed.Field name={<Bold>Status</Bold>}>Ready</Embed.Field>
    </Embed>
);
const embed: EmbedBuilder = renderEmbed(<View name="Standalone TSX" />);
if (embed.toJSON().title !== "Standalone TSX")
    throw new Error("Unexpected JSX output.");

const modal: ModalBuilder = renderModal(
    <Modal customId="standalone.modal" title="Standalone modal">
        <Modal.TextDisplay>
            <Bold>Instructions</Bold>
        </Modal.TextDisplay>
        <Modal.Label text="Name">
            <Modal.TextInput customId="name" />
        </Modal.Label>
    </Modal>,
);
if (modal.toJSON().custom_id !== "standalone.modal") {
    throw new Error("Unexpected modal output.");
}

const negativeTypes = () => {
    // @ts-expect-error The exported JSX types reject invalid props.
    const invalid = <Embed colour={1} />;
    const Async = async () => <Embed />;
    // @ts-expect-error Asynchronous components are unsupported.
    const asynchronous = <Async />;
    // @ts-expect-error Intrinsic HTML is unsupported.
    const intrinsic = <div />;
    // @ts-expect-error Modal input IDs are required in the published authoring types.
    const missingId = <Modal.TextInput />;
    // @ts-expect-error Public style conveniences are restricted.
    const badStyle = <Modal.TextInput customId="id" style="multiline" />;
    void [invalid, asynchronous, intrinsic, missingId, badStyle];
};
void negativeTypes;
