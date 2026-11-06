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
    InputContext,
    InputOptions,
    KnownKeys,
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

export type ModalContext<Spec extends ValidModalSpec<Spec> = EmptySpec> =
    ModalParamsContext<SpecParams<Spec>> & InputContext<SpecInput<Spec>>;

export type ModalHandlerOptions<Spec extends ValidModalSpec<Spec> = EmptySpec> =
    {
        /** Guards run before input, so they see params but never `ctx.input`. */
        guards?: readonly GuardProvider<ModalParamsContext<SpecParams<Spec>>>[];
    } & InputOptions<SpecInput<Spec>, ModalInputDefinition<SpecParams<Spec>>> &
        /*
         * A form template (`builder`) is recommended, since `input` reads its
         * modal-control custom IDs; callers get copies through `client.modals.build()`.
         */
        RouteOptions<SpecParams<Spec>, ModalBuilder>;

export abstract class ModalHandler<
    Spec extends ValidModalSpec<Spec> = EmptySpec,
> {
    readonly builder: ModalBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<
        ModalParamsContext<SpecParams<Spec>>
    >[];

    readonly input: ModalInputDefinition | undefined;

    protected constructor(options: ModalHandlerOptions<Spec>) {
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
    }

    abstract run(ctx: ModalContext<Spec>): Promise<void>;
}
