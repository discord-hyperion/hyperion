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

export type ModalOptions<
    Input extends ModalInputDefinition | undefined = undefined,
> = {
    builder: ModalBuilder;
    guards?: readonly GuardProvider<ModalContext>[];
} & (Input extends ModalInputDefinition ? { input: Input } : { input?: never });

export abstract class Modal<
    Input extends ModalInputDefinition | undefined = undefined,
> {
    readonly builder: ModalBuilder;
    readonly customId: string;
    readonly guards: readonly GuardProvider<ModalContext>[];

    readonly input: ModalInputDefinition | undefined;

    protected constructor(options: ModalOptions<Input>) {
        this.builder = options.builder;
        this.customId = this.builder.toJSON(false).custom_id;
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
