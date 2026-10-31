import { type ModalContext, Modal as ModalHandler } from "@hyperion/core";
import { renderModal } from "@hyperion/jsx";
import { MessageFlags } from "discord.js";
import { TodoForm } from "../views/todo-form.tsx";

export default class extends ModalHandler {
    constructor() {
        super({ builder: renderModal(<TodoForm />) });
    }

    async run(ctx: ModalContext) {
        const name = ctx.interaction.components.getTextInputValue("name");
        const description =
            ctx.interaction.components.getTextInputValue("description");

        await ctx.interaction.reply({
            content: `Received a todo name of ${name.length} characters and description of ${description.length} characters. This demo does not store submissions.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    }
}
