import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { renderModal } from "@hyperion/jsx";
import { TodoForm } from "../../views/todo-form.tsx";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("modal")
        .setDescription("Open a personalized JSX todo form."),
    async run(ctx) {
        await ctx.interaction.showModal(renderModal(<TodoForm />));
    },
});
