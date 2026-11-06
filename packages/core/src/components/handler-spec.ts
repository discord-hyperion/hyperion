import type {
    CommandInputDefinition,
    CommandInputResult,
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
