import { Modal as ModalHandler } from "@hyperion/core";
import { Modal, renderModal } from "@hyperion/jsx";

export default class extends ModalHandler {
    constructor() {
        super({
            builder: renderModal(
                <Modal customId="consumer.modal" title="Consumer modal">
                    <Modal.Label text="Name">
                        <Modal.TextInput customId="name" />
                    </Modal.Label>
                </Modal>,
            ),
        });
    }

    async run() {}
}
