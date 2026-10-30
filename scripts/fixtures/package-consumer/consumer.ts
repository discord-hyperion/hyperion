import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext, defineInput } from "@hyperion/core";
import * as v from "valibot";

const input = defineInput({
    schema: v.object({ id: v.string() }),
    resolve: async ({ id }) => ({ todo: { id }, found: true }),
});
export class TypedCommand extends Command<typeof input> {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("typed")
                .setDescription("Typed"),
            input,
        });
    }
    async run(ctx: CommandContext<typeof input>) {
        const [issues, value] = ctx.input;
        if (issues) return;
        value.todo.id satisfies string;
        value.found satisfies boolean;
        // @ts-expect-error Inferred output must not degrade to any.
        value.missing;
        // @ts-expect-error Inferred id remains a string.
        const _wrong: number = value.todo.id;
    }
}
