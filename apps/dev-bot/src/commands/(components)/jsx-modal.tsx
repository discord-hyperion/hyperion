import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { renderModal } from "@hyperion/jsx";
import { TodoForm } from "../../views/todo-form.tsx";

export default class extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("jsx-modal")
                .setDescription("Open a personalized JSX todo form."),
        });
    }

    async run(ctx: CommandContext) {
        await ctx.interaction.showModal(renderModal(<TodoForm />));
    }
}
