import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    Command,
    type CommandContext,
    defineInput,
    type EventContext,
    EventHandler,
} from "@hyperion/core";
import type { Events } from "discord.js";
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

class ReadyHandler extends EventHandler<Events.ClientReady> {
    async run(ctx: EventContext<Events.ClientReady>) {
        ctx.args[0].user.id satisfies string;
        // @ts-expect-error Readiness provides one argument, not an arbitrary tuple.
        ctx.args[1];
        // @ts-expect-error Managed event registries do not permit raw mutation.
        ctx.client.events.clear();
    }
}
void ReadyHandler;
