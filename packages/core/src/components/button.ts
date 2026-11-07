import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import { type ParamsDefinition, validateParams } from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";
import type {
    EmptySpec,
    HandlerResult,
    KnownKeys,
    ParamsContext,
    RouteOptions,
    SpecParams,
} from "./handler-spec.ts";

/** The keys a button context's type argument may set. */
export type ButtonSpec = { params?: ParamsDefinition };

/** A button type argument with only known keys. */
export type ValidButtonSpec<Spec> = ButtonSpec & KnownKeys<Spec, ButtonSpec>;

/** The context for a spec the caller built, so its keys are already known. */
type ButtonContextOf<Spec> = InteractionContext<ButtonInteraction> &
    ParamsContext<SpecParams<Spec>>;

export type ButtonContext<Spec extends ValidButtonSpec<Spec> = EmptySpec> =
    ButtonContextOf<Spec>;

type ButtonRun<Spec> = (ctx: ButtonContextOf<Spec>) => HandlerResult;

export type ButtonHandlerOptions<Spec extends ButtonSpec = EmptySpec> = {
    guards?: readonly GuardProvider<ButtonContextOf<Spec>>[];
} & RouteOptions<SpecParams<Spec>, CustomIdButtonBuilder>;

export class ButtonHandler<Spec extends ButtonSpec = EmptySpec> {
    readonly builder: CustomIdButtonBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<ButtonContextOf<Spec>>[];
    // Stored loosely so handlers of different specs stay assignable, as an
    // abstract method's would; run() restores the type.
    readonly #run: ((ctx: never) => HandlerResult) | undefined;

    constructor(
        options: ButtonHandlerOptions<Spec> & { run?: ButtonRun<Spec> },
    ) {
        this.params = validateParams(options.params);
        this.customId = handlerCustomId(
            "Button",
            options.customId,
            this.params,
            options.builder,
        );
        this.builder = options.builder;
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;

            if (!isGuard(provider)) {
                throw new TypeError(
                    "Button guards must be guards from defineGuard() or guard factories.",
                );
            }
        }

        this.#run = options.run;
    }

    run(ctx: ButtonContextOf<Spec>): HandlerResult {
        if (!this.#run) {
            throw new TypeError("Button handlers must provide a run() method.");
        }

        return this.#run(ctx as never);
    }
}

type ParamsSpec<Params> = Params extends ParamsDefinition
    ? { params: Params }
    : EmptySpec;

/** Defines a button handler. Its params and context types are inferred. */
export const defineButton = <
    Params extends ParamsDefinition | undefined = undefined,
>(
    options: {
        params?: Params;
        guards?: readonly GuardProvider<ButtonContextOf<ParamsSpec<Params>>>[];
        run: ButtonRun<ParamsSpec<Params>>;
    } & RouteOptions<NoInfer<Params>, CustomIdButtonBuilder>,
): ButtonHandler<ParamsSpec<Params>> => {
    if (typeof options?.run !== "function") {
        throw new TypeError("Button handlers must provide a run() function.");
    }

    // The options match the inferred spec; TypeScript can't relate the two
    // forms of the route options while Params is still generic.
    const handler = new ButtonHandler<ParamsSpec<Params>>(options as never);

    Object.freeze(handler);

    return handler;
};
