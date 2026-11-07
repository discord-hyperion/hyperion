import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
import { renderModal } from "@hyperion/jsx";
import { TodoForm } from "../../views/todo-form.tsx";

export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("jsx-modal")
        .setDescription("Open a personalized JSX todo form."),
    async run(ctx) {
        await ctx.interaction.showModal(renderModal(<TodoForm />));
    },
});
