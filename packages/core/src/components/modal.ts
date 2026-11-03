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
import { handlerCustomId } from "./handler-options.ts";

export type ModalInputDefinition = CommandInputDefinition<
    InteractionContext<ModalSubmitInteraction>
>;
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
    Input extends ModalInputDefinition | undefined = undefined,
> = InteractionContext<ModalSubmitInteraction> &
    (Input extends ModalInputDefinition
        ? { readonly input: CommandInputResult<Input> }
        : unknown);

export type ModalHandlerOptions<
    Input extends ModalInputDefinition | undefined = undefined,
> = {
    customId: string;
    /**
     * Optional form template; callers get copies through `client.modals.build()`.
     * Recommended, since `input` reads the form's text-input custom IDs.
     */
    builder?: ModalBuilder;
    guards?: readonly GuardProvider<ModalContext>[];
} & (Input extends ModalInputDefinition ? { input: Input } : { input?: never });

export abstract class ModalHandler<
    Input extends ModalInputDefinition | undefined = undefined,
> {
    readonly builder: ModalBuilder | undefined;
    readonly customId: string;
    readonly guards: readonly GuardProvider<ModalContext>[];

    readonly input: ModalInputDefinition | undefined;

    protected constructor(options: ModalHandlerOptions<Input>) {
        this.customId = handlerCustomId("Modal", options.customId, undefined);
        this.builder = options.builder;
        this.input = validateInput(options.input);
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

    abstract run(ctx: ModalContext<Input>): Promise<void>;
}
