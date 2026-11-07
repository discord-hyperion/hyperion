import type { ModalBuilder } from "@discordjs/builders";
import type { ModalSubmitInteraction } from "discord.js";
import type {
    CommandInputDefinition,
    CommandInputOptions,
    CommandInputResolver,
    CommandInputSchema,
    InputDefer,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import { validateInput } from "../util/validate-input.ts";
import { type ParamsDefinition, validateParams } from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";
import type {
    AnyInputDefinition,
    EmptySpec,
    HandlerInput,
    HandlerResult,
    InferredInput,
    InferredSpec,
    InputContext,
    InputOptions,
    KnownKeys,
    NoResolve,
    ParamsContext,
    RouteOptions,
    SpecInput,
    SpecParams,
} from "./handler-spec.ts";

/** The submission context guards and input resolvers see: params, never input. */
type ModalParamsContext<
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<ModalSubmitInteraction> & ParamsContext<Params>;

export type ModalInputDefinition<
    Params extends ParamsDefinition | undefined = undefined,
> = CommandInputDefinition<ModalParamsContext<Params>, InputDefer>;
export type ModalInputOptions<
    Schema extends CommandInputSchema = CommandInputSchema,
    Result = unknown,
> = CommandInputOptions<
    Schema,
    Result,
    InteractionContext<ModalSubmitInteraction>,
    InputDefer
>;
export type ModalInputResolver<
    Value = unknown,
    Result = unknown,
> = CommandInputResolver<
    Value,
    Result,
    InteractionContext<ModalSubmitInteraction>
>;

/** The keys a modal handler's type argument may set. */
export type ModalSpec = {
    params?: ParamsDefinition;
    input?: AnyInputDefinition;
};

/** A modal type argument: known keys, and input whose resolver accepts the context. */
export type ValidModalSpec<Spec> = ModalSpec &
    KnownKeys<Spec, ModalSpec> & {
        input?: ModalInputDefinition<SpecParams<Spec>>;
    };

/** The context for a spec the caller built, so its keys are already known. */
type ModalContextOf<Spec> = ModalParamsContext<SpecParams<Spec>> &
    InputContext<SpecInput<Spec>>;

export type ModalContext<Spec extends ValidModalSpec<Spec> = EmptySpec> =
    ModalContextOf<Spec>;

type ModalRun<Spec> = (ctx: ModalContextOf<Spec>) => HandlerResult;

export type ModalHandlerOptions<Spec extends ModalSpec = EmptySpec> = {
    /** Guards run before input, so they see params but never `ctx.input`. */
    guards?: readonly GuardProvider<ModalParamsContext<SpecParams<Spec>>>[];
} & InputOptions<SpecInput<Spec>, ModalInputDefinition<SpecParams<Spec>>> &
    /*
     * A form template (`builder`) is recommended, since `input` reads its
     * modal-control custom IDs; callers get copies through `client.modals.build()`.
     */
    RouteOptions<SpecParams<Spec>, ModalBuilder>;

export class ModalHandler<Spec extends ModalSpec = EmptySpec> {
    readonly builder: ModalBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<
        ModalParamsContext<SpecParams<Spec>>
    >[];

    readonly input: ModalInputDefinition | undefined;
    // Stored loosely so handlers of different specs stay assignable to each
    // other; run() restores the type.
    readonly #run: (ctx: never) => HandlerResult;

    constructor(options: ModalHandlerOptions<Spec> & { run: ModalRun<Spec> }) {
        this.params = validateParams(options.params);
        this.customId = handlerCustomId(
            "Modal",
            options.customId,
            this.params,
            options.builder,
        );
        this.builder = options.builder;
        this.input = validateInput(
            options.input as ModalInputDefinition | undefined,
            { update: true },
        );
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;

            if (!isGuard(provider)) {
                throw new TypeError(
                    "Modal guards must be guards from defineGuard() or guard factories.",
                );
            }
        }

        this.#run = options.run;
    }

    run(ctx: ModalContextOf<Spec>): HandlerResult {
        return this.#run(ctx as never);
    }
}

type DefinedModalSpec<
    Params,
    Schema extends CommandInputSchema | undefined,
    Result,
    Defer extends InputDefer,
> = InferredSpec<{
    params: Params;
    input: InferredInput<
        Schema,
        Result,
        ModalParamsContext<Params & (ParamsDefinition | undefined)>,
        Defer
    >;
}>;

/** Defines a modal handler. Its params, input, and context types are inferred. */
export const defineModal = <
    Params extends ParamsDefinition | undefined = undefined,
    Schema extends CommandInputSchema | undefined = undefined,
    Result = NoResolve,
    Defer extends InputDefer = false,
>(
    options: {
        params?: Params;
        input?: HandlerInput<Schema, Result, ModalParamsContext<Params>, Defer>;
        guards?: readonly GuardProvider<ModalParamsContext<Params>>[];
        run: ModalRun<DefinedModalSpec<Params, Schema, Result, Defer>>;
    } & RouteOptions<NoInfer<Params>, ModalBuilder>,
): ModalHandler<DefinedModalSpec<Params, Schema, Result, Defer>> => {
    if (typeof options?.run !== "function") {
        throw new TypeError("Modal handlers must provide a run() function.");
    }

    // The options match the inferred spec; TypeScript can't relate the two
    // forms while the type parameters are still generic.
    const handler = new ModalHandler<
        DefinedModalSpec<Params, Schema, Result, Defer>
    >(options as never);

    Object.freeze(handler);

    return handler;
};
