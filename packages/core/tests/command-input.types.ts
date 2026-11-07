import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
    ApplicationCommandType,
    ChatInputCommandInteraction,
} from "discord.js";
import {
    type CommandContext,
    type CommandInputOptions,
    type CommandInputOutput,
    type CommandInputResult,
    type CommandOptions,
    type CommandRegistry,
    defineCommand,
    defineInput,
    defineSubcommand,
    type Subcommand,
    type SubcommandOptions,
} from "../src/index.ts";

type Todo = { id: string; name: string };
type RawSchema = StandardSchemaV1<
    { id: string; deadline: string; description?: string },
    { id: string; deadline: Date; description: string }
>;

export const inferredInputContracts = (
    schema: RawSchema,
    registry: CommandRegistry,
    ctx: CommandContext,
) => {
    const input = defineInput({
        schema,
        defer: true,
        resolve: async (values, resolverCtx) => {
            values.id satisfies string;
            values.deadline satisfies Date;
            values.description satisfies string;
            resolverCtx satisfies CommandContext;
            // @ts-expect-error Resolvers receive the original context.
            resolverCtx.input;
            // @ts-expect-error Schema output fields are checked.
            values.missing;
            const todo: Todo | null = values.id
                ? { id: values.id, name: values.description }
                : null;

            return {
                todo,
                message: values.description,
                overdue: values.deadline < new Date(),
            };
        },
    });
    const passthrough = defineInput({ schema });
    input satisfies CommandInputOptions<RawSchema>;
    passthrough satisfies CommandInputOptions<RawSchema>;

    const TodoCommand = defineCommand({
        builder: new ChatInputCommandBuilder()
            .setName("todo")
            .setDescription("Todo"),
        input,
        guards: [
            ctx => {
                ctx.interaction satisfies ChatInputCommandInteraction;
                // @ts-expect-error Guards run before validation and resolution.
                ctx.input;
                throw new Error("Type-only fixture");
            },
        ],
        async run(ctx) {
            const [issues, value] = ctx.input;

            if (issues) {
                value satisfies undefined;
                issues satisfies readonly StandardSchemaV1.Issue[];

                return;
            }

            value.todo satisfies Todo | null;
            value.message satisfies string;
            value.overdue satisfies boolean;
            // @ts-expect-error Nullable todo results must be checked.
            value.todo.name;

            if (value.todo) {
                value.todo.name satisfies string;
            }

            // @ts-expect-error Resolver output replaces raw schema fields.
            value.deadline;
            // @ts-expect-error Input results are readonly.
            ctx.input = [null, value];
        },
    });

    const TodoSubcommand = defineSubcommand({
        builder: new ChatInputCommandSubcommandBuilder()
            .setName("todo")
            .setDescription("Todo"),
        input,
        async run(ctx) {
            const [issues, value] = ctx.input;
            if (issues) return;
            value.todo satisfies Todo | null;
            value.message satisfies string;
        },
    });

    registry.set("todo", TodoCommand);
    registry.set("tools todo", TodoSubcommand);
    ({
        builder: new ChatInputCommandBuilder(),
        input,
    }) satisfies CommandOptions<typeof input>;
    ({
        builder: new ChatInputCommandSubcommandBuilder(),
        input,
    }) satisfies SubcommandOptions<typeof input>;
    // @ts-expect-error A typed definition requires the input object.
    ({ builder: new ChatInputCommandBuilder() }) satisfies CommandOptions<
        typeof input
    >;
    ({
        builder: new ChatInputCommandBuilder(),
        // @ts-expect-error Schema-free commands cannot configure input.
        input,
    }) satisfies CommandOptions;
    ({
        // @ts-expect-error Input definitions describe chat-input commands.
        builder: new UserContextCommandBuilder(),
        input,
    }) satisfies CommandOptions<typeof input>;
    ({
        builder: new UserContextCommandBuilder(),
        // @ts-expect-error Context-menu commands do not accept input definitions.
        input,
    }) satisfies CommandOptions<ApplicationCommandType.User>;
    // @ts-expect-error The generic is the input definition, not a schema.
    type _SchemaGeneric = Subcommand<RawSchema>;
    // @ts-expect-error The context generic is the input definition, not a schema.
    type _SchemaContext = CommandContext<RawSchema>;
    // @ts-expect-error Schema-free contexts do not expose input.
    ctx.input;

    return { input, passthrough };
};

type Definitions = ReturnType<typeof inferredInputContracts>;

export const inputOutputContracts = (
    resolved: CommandInputResult<Definitions["input"]>,
    plain: CommandContext<Definitions["passthrough"]>,
    promisedSchema: StandardSchemaV1<unknown, Promise<Todo>>,
) => {
    const [issues, value] = resolved;

    if (!issues) {
        value satisfies CommandInputOutput<Definitions["input"]>;
        value.todo satisfies Todo | null;
        value.message satisfies string;
    }

    const [schemaIssues, schemaValue] = plain.input;

    if (!schemaIssues) {
        schemaValue.id satisfies string;
        schemaValue.deadline satisfies Date;
        schemaValue.description satisfies string;
    }

    const promisedInput = defineInput({ schema: promisedSchema });
    const promisedOutput = (
        value: CommandInputOutput<typeof promisedInput>,
    ) => {
        value satisfies Promise<Todo>;
    };

    return promisedOutput;
};

export const invalidInputContracts = (schema: RawSchema) => {
    // @ts-expect-error An input configuration requires a schema.
    defineInput({ defer: true });
    // @ts-expect-error A resolver's argument comes from the schema output.
    defineInput({ schema, resolve: (id: string) => id });
    // @ts-expect-error Resolver configuration must be callable.
    defineInput({ schema, resolve: 42 });
    // @ts-expect-error Per-option resolvers have been replaced.
    defineInput({ schema, resolvers: {} });
    // @ts-expect-error Deferral remains a boolean.
    defineInput({ schema, defer: "private" });
};
