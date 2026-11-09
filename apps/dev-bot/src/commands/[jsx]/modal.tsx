import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion-js/core";
import { renderModal } from "@hyperion-js/jsx";
import { TodoForm } from "../../views/todo-form.tsx";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("modal")
        .setDescription("Open a personalized JSX todo form."),
    run: async ctx => {
        await ctx.interaction.showModal(renderModal(<TodoForm />));
    },
});
