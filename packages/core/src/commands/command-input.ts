import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ChatInputCommandInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";

type InputCommandContext = InteractionContext<ChatInputCommandInteraction>;

export type CommandInputSchema = StandardSchemaV1;

/**
 * `true` privately defers a reply; `"update"` defers an update to the message the
 * interaction came from, which only components and message modals have.
 */
export type InputDefer = boolean | "update";

/** Receives the complete schema output with the original invocation context. */
export type CommandInputResolver<
    Value = unknown,
    Result = unknown,
    Context = InputCommandContext,
> = (value: Value, ctx: Context) => Result | Promise<Result>;

/** Shared definition with the application's resolver argument type erased. */
export type CommandInputDefinition<
    Context = InputCommandContext,
    Defer extends InputDefer = boolean,
> = {
    readonly schema: CommandInputSchema;
    readonly resolve?: CommandInputResolver<never, unknown, Context>;
    readonly defer?: Defer;
};

/** Schema and processing policy for an executable chat-input handler. */
export type CommandInputOptions<
    Schema extends CommandInputSchema = CommandInputSchema,
    Result = unknown,
    Context = InputCommandContext,
    Defer extends InputDefer = boolean,
> = {
    readonly schema: Schema;
    readonly resolve?: CommandInputResolver<
        StandardSchemaV1.InferOutput<Schema>,
        Result,
        Context
    >;
    /** Defer after guards and before input processing. */
    readonly defer?: Defer;
};

type ResolverOutput<Input extends CommandInputDefinition<never, InputDefer>> =
    Input["resolve"] extends infer Resolve
        ? Resolve extends CommandInputResolver<never, infer Result, never>
            ? Awaited<Result>
            : never
        : never;

/** Preserve schema output unless a resolver replaces it. */
export type CommandInputOutput<
    Input extends CommandInputDefinition<never, InputDefer>,
> = Input extends {
    readonly resolve: CommandInputResolver<never, unknown, never>;
}
    ? ResolverOutput<Input>
    : StandardSchemaV1.InferOutput<Input["schema"]> | ResolverOutput<Input>;

/** A schema failure exposes no partial output. */
export type CommandInputResult<
    Input extends CommandInputDefinition<never, InputDefer>,
> =
    | readonly [issues: null, input: CommandInputOutput<Input>]
    | readonly [issues: readonly StandardSchemaV1.Issue[], input: undefined];

/** Infer resolver arguments and results without executing input processing. */
export const defineInput: {
    <
        Schema extends CommandInputSchema,
        Result,
        Context = InputCommandContext,
        Resolve extends CommandInputResolver<
            StandardSchemaV1.InferOutput<Schema>,
            Result,
            Context
        > = CommandInputResolver<
            StandardSchemaV1.InferOutput<Schema>,
            Result,
            Context
        >,
        Defer extends InputDefer = false,
    >(input: {
        readonly schema: Schema;
        readonly defer?: Defer;
        readonly resolve: Resolve &
            CommandInputResolver<
                StandardSchemaV1.InferOutput<Schema>,
                Result,
                Context
            >;
    }): {
        readonly schema: Schema;
        readonly defer?: Defer;
        readonly resolve: Resolve;
    };
    <
        Schema extends CommandInputSchema,
        Defer extends InputDefer = false,
    >(input: {
        readonly schema: Schema;
        readonly defer?: Defer;
        readonly resolve?: never;
    }): {
        readonly schema: Schema;
        readonly defer?: Defer;
        readonly resolve?: never;
    };
} = <Input extends CommandInputDefinition<never, InputDefer>>(input: Input) =>
    input;
