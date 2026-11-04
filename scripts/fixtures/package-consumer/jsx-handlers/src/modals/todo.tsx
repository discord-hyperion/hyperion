import { defineInput, type ModalContext, ModalHandler } from "@hyperion/core";
import { Modal, renderModal } from "@hyperion/jsx";
import * as v from "valibot";

const input = defineInput({
    schema: v.object({ name: v.string() }),
    resolve: async ({ name }, ctx: ModalContext) => ({
        name,
        owner: ctx.interaction.user.id,
    }),
});

type TodoSpec = { input: typeof input };

export default class extends ModalHandler<TodoSpec> {
    constructor() {
        super({
            customId: "consumer.modal",
            builder: renderModal(
                <Modal customId="consumer.modal" title="Consumer modal">
                    <Modal.Label text="Name">
                        <Modal.TextInput customId="name" />
                    </Modal.Label>
                </Modal>,
            ),
            input,
        });
    }

    async run(ctx: ModalContext<TodoSpec>) {
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
    }
}
