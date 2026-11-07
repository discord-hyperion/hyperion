import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import type { ApplicationCommandType } from "discord.js";
import type {
    HandlerInput,
    HandlerResult,
    InferredInput,
    NoResolve,
} from "../components/handler-spec.ts";
import type { GuardProvider } from "../guards/index.ts";
import type { AutocompleteContext, CommandContext } from "./command.ts";
import type {
    CommandInputDefinition,
    CommandInputSchema,
} from "./command-input.ts";
import { freezeCommandGuards } from "./freeze-command-guards.ts";
import { validateCommandInput } from "./validate-command-input.ts";

export type SubcommandOptions<
    Input extends CommandInputDefinition | undefined = undefined,
> = {
    builder: ChatInputCommandSubcommandBuilder;
    guards?: readonly GuardProvider<CommandContext>[];
} & (Input extends CommandInputDefinition
    ? { input: Input }
    : { input?: never });

type SubcommandContext<Input> = CommandContext<
    Input extends CommandInputDefinition
        ? Input
        : ApplicationCommandType.ChatInput
>;

/** A bare `Subcommand` is any subcommand, with or without input. */
export class Subcommand<
    Input extends CommandInputDefinition | undefined =
        | CommandInputDefinition
        | undefined,
> {
    readonly builder: ChatInputCommandSubcommandBuilder;
    readonly guards: readonly GuardProvider<CommandContext>[];
    readonly input: CommandInputDefinition | undefined;
    // Stored loosely so subcommands with different input stay assignable, as an
    // abstract method's would; run() restores the type.
    readonly #run: ((ctx: never) => HandlerResult) | undefined;

    constructor(
        options: SubcommandOptions<Input> & {
            run?: (ctx: SubcommandContext<Input>) => HandlerResult;
            autocomplete?: (ctx: AutocompleteContext) => HandlerResult;
        },
    ) {
        if (!(options.builder instanceof ChatInputCommandSubcommandBuilder)) {
            throw new TypeError(
                "Subcommands require a ChatInputCommandSubcommandBuilder.",
            );
        }

        this.builder = options.builder;

        this.input = validateCommandInput(options.input);
        this.guards = freezeCommandGuards(options.guards);
        this.#run = options.run;

        if (options.autocomplete !== undefined) {
            this.autocomplete = options.autocomplete;
        }
    }

    run(ctx: SubcommandContext<Input>): HandlerResult {
        if (!this.#run) {
            throw new TypeError("Subcommands must provide a run() method.");
        }

        return this.#run(ctx as never);
    }

    autocomplete?(ctx: AutocompleteContext): HandlerResult;
}

/** Defines a subcommand. Its input and context types are inferred. */
export const defineSubcommand = <
    Schema extends CommandInputSchema | undefined = undefined,
    Result = NoResolve,
    Defer extends boolean = false,
>(options: {
    builder: ChatInputCommandSubcommandBuilder;
    input?: HandlerInput<Schema, Result, CommandContext, Defer>;
    guards?: readonly GuardProvider<CommandContext>[];
    run: (
        ctx: SubcommandContext<
            InferredInput<Schema, Result, CommandContext, Defer>
        >,
    ) => HandlerResult;
    autocomplete?: (ctx: AutocompleteContext) => HandlerResult;
}): Subcommand<InferredInput<Schema, Result, CommandContext, Defer>> => {
    if (typeof options?.run !== "function") {
        throw new TypeError("Subcommands must provide a run() function.");
    }

    if (
        options.autocomplete !== undefined &&
        typeof options.autocomplete !== "function"
    ) {
        throw new TypeError("Subcommand autocomplete() must be a function.");
    }

    // The options match the inferred input; TypeScript can't relate the two
    // forms while the type parameters are still generic.
    const subcommand = new Subcommand<
        InferredInput<Schema, Result, CommandContext, Defer>
    >(options as never);

    Object.freeze(subcommand);

    return subcommand;
};
