import { defineInput, defineModal, type ModalContext } from "@hyperion-js/core";
import { Modal, renderModal } from "@hyperion-js/jsx";
import * as v from "valibot";

const input = defineInput({
    schema: v.object({ name: v.string() }),
    resolve: async ({ name }, ctx: ModalContext) => ({
        name,
        owner: ctx.interaction.user.id,
    }),
});

export default defineModal({
    builder: renderModal(
        <Modal customId="consumer.modal" title="Consumer modal">
            <Modal.Label text="Name">
                <Modal.TextInput customId="name" />
            </Modal.Label>
        </Modal>,
    ),
    input,
    run: async ctx => {
        const [issues, value] = ctx.input;

        if (issues) {
            await ctx.interaction.reply("Invalid submission");

            return;
        }

        value.name satisfies string;
        value.owner satisfies string;
        // @ts-expect-error Resolved values remain typed.
        value.missing;

        await ctx.interaction.reply(`${value.owner}: ${value.name}`);
    },
});
