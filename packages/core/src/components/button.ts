import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import {
    type ParamsDefinition,
    type ParamsResult,
    validateParams,
} from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";

export type ButtonContext<
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<ButtonInteraction> &
    (Params extends ParamsDefinition
        ? { readonly params: ParamsResult<Params> }
        : unknown);

export type ButtonHandlerOptions<
    Params extends ParamsDefinition | undefined = undefined,
> = {
    /** Optional template; callers get copies through `client.buttons.build()`. */
    builder?: CustomIdButtonBuilder;
    guards?: readonly GuardProvider<ButtonContext<Params>>[];
} & (Params extends ParamsDefinition
    ? { params: Params; customId?: never }
    : { customId: string; params?: never });

export abstract class ButtonHandler<
    Params extends ParamsDefinition | undefined = undefined,
> {
    readonly builder: CustomIdButtonBuilder | undefined;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<ButtonContext<Params>>[];

    protected constructor(options: ButtonHandlerOptions<Params>) {
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

    abstract run(ctx: ButtonContext<Params>): Promise<void>;
}
