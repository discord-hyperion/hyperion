import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import { type ParamsDefinition, validateParams } from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";
import type {
    EmptySpec,
    KnownKeys,
    ParamsContext,
    ParamsOptions,
    SpecParams,
} from "./handler-spec.ts";

/** The keys a button handler's type argument may set. */
export type ButtonSpec = { params?: ParamsDefinition };

/** A button type argument with only known keys. */
export type ValidButtonSpec<Spec> = ButtonSpec & KnownKeys<Spec, ButtonSpec>;

export type ButtonContext<Spec extends ValidButtonSpec<Spec> = EmptySpec> =
    InteractionContext<ButtonInteraction> & ParamsContext<SpecParams<Spec>>;

export type ButtonHandlerOptions<
    Spec extends ValidButtonSpec<Spec> = EmptySpec,
> = {
    /** Optional template; callers get copies through `client.buttons.build()`. */
    builder?: CustomIdButtonBuilder;
    guards?: readonly GuardProvider<ButtonContext<Spec>>[];
} & ParamsOptions<SpecParams<Spec>>;

export abstract class ButtonHandler<
    Spec extends ValidButtonSpec<Spec> = EmptySpec,
> {
    readonly builder: CustomIdButtonBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<ButtonContext<Spec>>[];

    protected constructor(options: ButtonHandlerOptions<Spec>) {
        this.params = validateParams(options.params);
        this.customId = handlerCustomId(
            "Button",
            options.customId,
            this.params,
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
    }

    abstract run(ctx: ButtonContext<Spec>): Promise<void>;
}
