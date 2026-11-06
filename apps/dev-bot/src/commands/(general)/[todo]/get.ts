import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, defineInput, Subcommand } from "@hyperion/core";
import { todos } from "../../../database.ts";
import { getTodoSchema } from "./index.ts";

const input = defineInput({
    schema: getTodoSchema,
    defer: true,
    resolve: ({ id }) => ({ todo: todos.get({ id }) }),
});

export default class extends Subcommand<typeof input> {
    constructor() {
        super({
            input,
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("get")
                .setDescription("Get a todo by its id.")
                .addStringOptions(option =>
                    option.setName("id").setDescription("The id of the todo."),
                ),
        });
    }

    async run(ctx: CommandContext<typeof input>): Promise<void> {
        const [issues, input] = ctx.input;

        if (issues) {
            await ctx.interaction.editReply({
                content: issues.map(issue => issue.message).join("\n"),
            });

            return;
        }

        const { todo } = input;

        await ctx.interaction.editReply({
            content: todo
                ? `${todo.title}, due ${todo.deadline}`
                : "No todo has that ID.",
            allowedMentions: { parse: [] },
        });
    }
}
