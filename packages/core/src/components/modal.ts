import type { ModalBuilder } from "@discordjs/builders";
import type { ModalSubmitInteraction } from "discord.js";
import type {
    CommandInputDefinition,
    CommandInputOptions,
    CommandInputResolver,
    CommandInputResult,
    CommandInputSchema,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";
import { validateInput } from "../util/validate-input.ts";
import {
    type ParamsDefinition,
    type ParamsResult,
    validateParams,
} from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";

/** The submission context guards and input resolvers see: params, never input. */
type ModalParamsContext<
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<ModalSubmitInteraction> &
    (Params extends ParamsDefinition
        ? { readonly params: ParamsResult<Params> }
        : unknown);

export type ModalInputDefinition<
    Params extends ParamsDefinition | undefined = undefined,
> = CommandInputDefinition<ModalParamsContext<Params>>;
export type ModalInputOptions<
    Schema extends CommandInputSchema = CommandInputSchema,
    Result = unknown,
> = CommandInputOptions<
    Schema,
    Result,
    InteractionContext<ModalSubmitInteraction>
>;
export type ModalInputResolver<
    Value = unknown,
    Result = unknown,
> = CommandInputResolver<
    Value,
    Result,
    InteractionContext<ModalSubmitInteraction>
>;

export type ModalContext<
    Input extends ModalInputDefinition<Params> | undefined = undefined,
    Params extends ParamsDefinition | undefined = undefined,
> = ModalParamsContext<Params> &
    (Input extends ModalInputDefinition<Params>
        ? { readonly input: CommandInputResult<Input> }
        : unknown);

export type ModalHandlerOptions<
    Input extends ModalInputDefinition<Params> | undefined = undefined,
    Params extends ParamsDefinition | undefined = undefined,
> = {
    /**
     * Optional form template; callers get copies through `client.modals.build()`.
     * Recommended, since `input` reads the form's text-input custom IDs.
     */
    builder?: ModalBuilder;
    /** Guards run before input, so they see params but never `ctx.input`. */
    guards?: readonly GuardProvider<ModalContext<undefined, Params>>[];
} & (Input extends ModalInputDefinition<Params>
    ? { input: Input }
    : { input?: never }) &
    (Params extends ParamsDefinition
        ? { params: Params; customId?: never }
        : { customId: string; params?: never });

export abstract class ModalHandler<
    Input extends ModalInputDefinition<Params> | undefined = undefined,
    Params extends ParamsDefinition | undefined = undefined,
> {
    readonly builder: ModalBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<ModalContext<undefined, Params>>[];

    readonly input: ModalInputDefinition | undefined;

    protected constructor(options: ModalHandlerOptions<Input, Params>) {
        this.params = validateParams(options.params);
        this.customId = handlerCustomId("Modal", options.customId, this.params);
        this.builder = options.builder;
        this.input = validateInput(
            options.input as ModalInputDefinition | undefined,
        );
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Modal guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: ModalContext<Input, Params>): Promise<void>;
}
