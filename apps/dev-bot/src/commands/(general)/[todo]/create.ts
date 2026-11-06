import { randomUUID } from "node:crypto";
import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { type CommandContext, defineInput, Subcommand } from "@hyperion/core";
import { todos } from "../../../database.ts";
import { createTodoSchema } from "./index.ts";

const input = defineInput({
    schema: createTodoSchema,
    defer: true,
    resolve: ({ title, deadline, description }) =>
        todos.set({
            id: randomUUID().slice(0, 8),
            title,
            deadline,
            description: description ?? null,
        }),
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
            content: `Created todo ${value.id}: ${value.title}`,
            allowedMentions: { parse: [] },
        });
    }
}
