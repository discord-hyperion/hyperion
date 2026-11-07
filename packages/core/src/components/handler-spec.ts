import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
    CommandInputDefinition,
    CommandInputResolver,
    CommandInputResult,
    CommandInputSchema,
    InputDefer,
} from "../commands/command-input.ts";
import type { ParamsDefinition, ParamsResult } from "./custom-id-params.ts";

/** An input definition with its resolver context erased. */
export type AnyInputDefinition = CommandInputDefinition<never, InputDefer>;

/** A type argument with no keys: no params, no input. */
export type EmptySpec = Record<never, never>;

/**
 * Rejects keys a handler's type argument doesn't define, because TypeScript
 * doesn't check excess keys in type arguments: `{ inptu: … }` would otherwise
 * compile and quietly mean "no input".
 */
export type KnownKeys<Spec, Shape> = {
    readonly [Key in Exclude<keyof Spec, keyof Shape>]: never;
};

export type SpecParams<Spec> = Spec extends {
    params: infer Params extends ParamsDefinition;
}
    ? Params
    : undefined;

export type SpecInput<Spec> = Spec extends {
    input: infer Input extends AnyInputDefinition;
}
    ? Input
    : undefined;

export type ParamsContext<Params> = Params extends ParamsDefinition
    ? { readonly params: ParamsResult<Params> }
    : unknown;

export type InputContext<Input> = Input extends AnyInputDefinition
    ? { readonly input: CommandInputResult<Input> }
    : unknown;

/**
 * How a handler gets its ID. A params handler routes by its params ID, and its
 * optional template must carry that route. Any other handler takes either an
 * exact custom ID or a template whose custom ID becomes the handler's.
 */
export type RouteOptions<Params, Template> = Params extends ParamsDefinition
    ? { params: Params; customId?: never; builder?: Template }
    :
          | { customId: string; params?: never; builder?: never }
          | { builder: Template; params?: never; customId?: never };

/** A typed handler must configure input whose resolver accepts its context. */
export type InputOptions<Input, Definition> = Input extends Definition
    ? { input: Input }
    : { input?: never };

declare const noResolve: unique symbol;

/** The result a `define…()` function infers when input has no resolver. */
export type NoResolve = typeof noResolve;

/**
 * Input as a `define…()` function takes it, inline or from `defineInput()`: the
 * resolver's value comes from the schema, so neither needs annotating.
 */
export type HandlerInput<
    Schema extends CommandInputSchema | undefined,
    Result,
    Context,
    Defer extends InputDefer,
> = {
    readonly schema: Schema;
    readonly resolve?: CommandInputResolver<
        StandardSchemaV1.InferOutput<NonNullable<Schema>>,
        Result,
        Context
    >;
    readonly defer?: Defer;
};

/** The input definition a handler's context is typed from, or `undefined`. */
export type InferredInput<
    Schema extends CommandInputSchema | undefined,
    Result,
    Context,
    Defer extends InputDefer,
> = Schema extends CommandInputSchema
    ? [Result] extends [NoResolve]
        ? {
              readonly schema: Schema;
              readonly resolve?: never;
              readonly defer?: Defer;
          }
        : {
              readonly schema: Schema;
              readonly resolve: CommandInputResolver<
                  StandardSchemaV1.InferOutput<Schema>,
                  Result,
                  Context
              >;
              readonly defer?: Defer;
          }
    : undefined;

/** A handler type argument built from inferred parts, without `undefined` keys. */
export type InferredSpec<Parts> = {
    [Key in keyof Parts as Parts[Key] extends undefined
        ? never
        : Key]: Parts[Key];
};

/** What every `define…()` function's `run` may return. */
export type HandlerResult = void | Promise<void>;
