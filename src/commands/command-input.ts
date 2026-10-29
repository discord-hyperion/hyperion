import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { CommandContext } from "./command.ts";

export type CommandInputSchema = StandardSchemaV1;

/** Receives the complete schema output with the original invocation context. */
export type CommandInputResolver<Value = unknown, Result = unknown> = (
    value: Value,
    ctx: CommandContext,
) => Result | Promise<Result>;

/** Shared definition with the application's resolver argument type erased. */
export type CommandInputDefinition = {
    readonly schema: CommandInputSchema;
    readonly resolve?: CommandInputResolver<never>;
    readonly defer?: boolean;
};

/** Schema and processing policy for an executable chat-input handler. */
export type CommandInputOptions<
    Schema extends CommandInputSchema = CommandInputSchema,
    Result = unknown,
> = {
    readonly schema: Schema;
    readonly resolve?: CommandInputResolver<
        StandardSchemaV1.InferOutput<Schema>,
        Result
    >;
    /** Privately defer after guards and before input processing. */
    readonly defer?: boolean;
};

type ResolverOutput<Input extends CommandInputDefinition> =
    Input["resolve"] extends infer Resolve
        ? Resolve extends CommandInputResolver<never, infer Result>
            ? Awaited<Result>
            : never
        : never;

/** Preserve schema output unless a resolver replaces it. */
export type CommandInputOutput<Input extends CommandInputDefinition> =
    Input extends { readonly resolve: CommandInputResolver<never> }
        ? ResolverOutput<Input>
        : StandardSchemaV1.InferOutput<Input["schema"]> | ResolverOutput<Input>;

/** A schema failure exposes no partial output. */
export type CommandInputResult<Input extends CommandInputDefinition> =
    | readonly [issues: null, input: CommandInputOutput<Input>]
    | readonly [issues: readonly StandardSchemaV1.Issue[], input: undefined];

/** Infer resolver arguments and results without executing input processing. */
export const defineInput: {
    <Schema extends CommandInputSchema, Result>(
        input: CommandInputOptions<Schema, Result> & {
            readonly resolve: CommandInputResolver<
                StandardSchemaV1.InferOutput<Schema>,
                Result
            >;
        },
    ): CommandInputOptions<Schema, Result> & {
        readonly resolve: CommandInputResolver<
            StandardSchemaV1.InferOutput<Schema>,
            Result
        >;
    };
    <Schema extends CommandInputSchema>(input: {
        readonly schema: Schema;
        readonly defer?: boolean;
        readonly resolve?: never;
    }): {
        readonly schema: Schema;
        readonly defer?: boolean;
        readonly resolve?: never;
    };
} = <Input extends CommandInputDefinition>(input: Input) => input;
