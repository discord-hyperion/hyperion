import type { CustomIdButtonBuilder } from "@discordjs/builders";
import type { ButtonInteraction } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";
import {
    type ParamsDefinition,
    type ParamsResult,
    validateParams,
} from "./custom-id-params.ts";

export type ButtonContext<
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<ButtonInteraction> &
    (Params extends ParamsDefinition
        ? { readonly params: ParamsResult<Params> }
        : unknown);

export type ButtonOptions<
    Params extends ParamsDefinition | undefined = undefined,
> = {
    guards?: readonly GuardProvider<ButtonContext<Params>>[];
} & (Params extends ParamsDefinition
    ? { params: Params; builder?: never }
    : { builder: CustomIdButtonBuilder; params?: never });

export abstract class Button<
    Params extends ParamsDefinition | undefined = undefined,
> {
    /** Literal handlers only; params handlers build their controls per call. */
    readonly builder: Params extends ParamsDefinition
        ? undefined
        : CustomIdButtonBuilder;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<ButtonContext<Params>>[];

    protected constructor(options: ButtonOptions<Params>) {
        if (options.builder !== undefined && options.params !== undefined) {
            throw new TypeError(
                "Button handlers accept either a builder or params, not both.",
            );
        }

        this.builder = options.builder as this["builder"];
        this.params = validateParams(options.params);

        const customId =
            this.params?.id ?? options.builder?.toJSON(false).custom_id;
        if (customId === undefined) {
            throw new TypeError("Button handlers require a builder or params.");
        }

        this.customId = customId;
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Button guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: ButtonContext<Params>): Promise<void>;
}
