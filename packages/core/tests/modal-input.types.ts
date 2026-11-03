import { ChatInputCommandBuilder, ModalBuilder } from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ModalSubmitInteraction } from "discord.js";
import {
    Command,
    defineInput,
    type ModalContext,
    ModalHandler,
    type ModalHandlerOptions,
    type ModalInputOptions,
    type ModalRegistry,
} from "../src/index.ts";

export const modalInputContracts = (
    schema: StandardSchemaV1<
        { name: string },
        { name: string; deadline: Date }
    >,
    registry: ModalRegistry,
    plain: ModalContext,
) => {
    const input = defineInput({
        schema,
        defer: true,
        resolve: async (values, ctx: ModalContext) => {
            values.name satisfies string;
            values.deadline satisfies Date;
            ctx.interaction satisfies ModalSubmitInteraction;
            // @ts-expect-error Resolvers receive the original context.
            ctx.input;
            // @ts-expect-error Resolver values come from schema output.
            values.missing;

            return {
                todo: { name: values.name, owner: ctx.interaction.user.id },
            };
        },
    });
    input satisfies ModalInputOptions<typeof schema>;

    class CreateTodo extends ModalHandler<typeof input> {
        constructor() {
            super({
                customId: "todo.create",
                builder: new ModalBuilder(),
                input,
                guards: [
                    ctx => {
                        ctx.interaction satisfies ModalSubmitInteraction;
                        // @ts-expect-error Guards run before input processing.
                        ctx.input;
                        throw new Error("Type-only fixture");
                    },
                ],
            });
        }

        async run(ctx: ModalContext<typeof input>) {
            const [issues, value] = ctx.input;
            if (issues) {
                value satisfies undefined;
                issues satisfies readonly StandardSchemaV1.Issue[];
                return;
            }

            value.todo.name satisfies string;
            value.todo.owner satisfies string;
            // @ts-expect-error Resolved output replaces schema output.
            value.deadline;
            // @ts-expect-error Result remains typed, not any.
            value.missing;
            // @ts-expect-error Input is readonly.
            ctx.input = [null, value];
        }
    }

    registry.set("todo.create", new CreateTodo());
    const withoutResolver = defineInput({ schema });
    const passthrough = (ctx: ModalContext<typeof withoutResolver>) => {
        const [issues, value] = ctx.input;
        if (issues) return;
        value.deadline satisfies Date;
        value.name satisfies string;
    };
    const missingInput = { builder: new ModalBuilder() };
    // @ts-expect-error Typed modals require input configuration.
    missingInput satisfies ModalHandlerOptions<typeof input>;
    const configured = { builder: new ModalBuilder(), input };
    // @ts-expect-error Schema-free modal definitions cannot configure input.
    configured satisfies ModalHandlerOptions;
    // @ts-expect-error Schema-free contexts have no input.
    plain.input;
    // @ts-expect-error Command resolvers cannot serve modal submissions.
    type _WrongContext = ModalHandler<ReturnType<typeof commandInput>>;
    const wrongCommand = { builder: new ChatInputCommandBuilder(), input };
    // @ts-expect-error Modal resolvers cannot serve chat-input commands.
    wrongCommand satisfies ConstructorParameters<typeof InputCommand>[0];

    return { CreateTodo, passthrough };
};

const commandInput = () =>
    defineInput({
        schema: {
            "~standard": {
                version: 1,
                vendor: "test",
                validate: value => ({ value }),
            },
        },
        resolve: (_value, ctx) => ctx.interaction.commandName,
    });

abstract class InputCommand extends Command<ReturnType<typeof commandInput>> {
    constructor(options: {
        builder: ChatInputCommandBuilder;
        input: ReturnType<typeof commandInput>;
    }) {
        super(options);
    }
}

export const contextFreeModalResolver = (
    schema: StandardSchemaV1<unknown, { name: string }>,
) => {
    const input = defineInput({
        schema,
        resolve: async ({ name }) => ({ todo: { name } }),
    });
    class ContextFree extends ModalHandler<typeof input> {
        constructor() {
            super({
                customId: "todo.create",
                builder: new ModalBuilder(),
                input,
            });
        }
        async run(ctx: ModalContext<typeof input>) {
            const [issues, value] = ctx.input;
            if (issues) return;
            value.todo.name satisfies string;
        }
    }
    return ContextFree;
};
