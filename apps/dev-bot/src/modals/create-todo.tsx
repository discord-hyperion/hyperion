import { defineInput, defineModal } from "@hyperion-js/core";
import { renderModal } from "@hyperion-js/jsx";
import * as v from "valibot";
import { TodoForm } from "../views/todo-form.tsx";

const input = defineInput({
    schema: v.object({
        name: v.pipe(
            v.string(),
            v.trim(),
            v.minLength(1, "Name must not be blank."),
        ),
        description: v.optional(v.string(), ""),
    }),
    defer: true,
});

export default defineModal({
    builder: renderModal(<TodoForm />),
    input,
    run: async ctx => {
        const [issues, value] = ctx.input;

        if (issues) {
            await ctx.interaction.editReply({
                content: issues.map(issue => issue.message).join("\n"),
                allowedMentions: { parse: [] },
            });

            return;
        }

        const { name, description } = value;

        await ctx.interaction.editReply({
            content: `Received a todo name of ${name.length} characters and description of ${description.length} characters. This demo does not store submissions.`,
            allowedMentions: { parse: [] },
        });
    },
});
