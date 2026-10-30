import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, defineInput, Subcommand } from "@hyperion/core";
import { createTodoSchema, fakeApi } from "./index.ts";

const input = defineInput({
    schema: createTodoSchema,
    defer: true,
    resolve: opts => fakeApi.createTodo(opts),
});

export default class extends Subcommand<typeof input> {
    constructor() {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("create")
                .setDescription("Create a new todo.")
                .addStringOptions(
                    option =>
                        option
                            .setName("title")
                            .setDescription("The title of the todo.")
                            .setRequired(),
                    option =>
                        option
                            .setName("deadline")
                            .setDescription("When this todo will expire.")
                            .setRequired(),
                    option =>
                        option
                            .setName("description")
                            .setDescription("The description of the todo.")
                            .setRequired(false),
                ),
            input,
        });
    }

    async run(ctx: CommandContext<typeof input>) {
        const [issues, value] = ctx.input;

        if (issues) {
            await ctx.interaction.editReply({
                content: issues.map(issue => issue.message).join("\n"),
            });
            return;
        }

        await ctx.interaction.editReply({
            content: Object.values(value).join("\n"),
        });
    }
}
