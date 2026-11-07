import type {
    ChatInputCommandBuilder,
    ContextMenuCommandBuilder,
    MessageContextCommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import {
    ApplicationCommandType,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    type MessageContextMenuCommandInteraction,
    type UserContextMenuCommandInteraction,
} from "discord.js";
import type {
    HandlerInput,
    HandlerResult,
    InferredInput,
    NoResolve,
} from "../components/handler-spec.ts";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import type {
    CommandInputDefinition,
    CommandInputResult,
    CommandInputSchema,
} from "./command-input.ts";
import { validateCommandInput } from "./validate-command-input.ts";

type ContextMenuCommandData<
    Type extends ApplicationCommandType.User | ApplicationCommandType.Message,
> = ReturnType<ContextMenuCommandBuilder["toJSON"]> & { type: Type };

declare module "@discordjs/builders" {
    // biome-ignore lint/style/useConsistentTypeDefinitions: merges into the builders package declaration.
    interface UserContextCommandBuilder {
        toJSON(
            validationOverride?: boolean,
        ): ContextMenuCommandData<ApplicationCommandType.User>;
    }

    // biome-ignore lint/style/useConsistentTypeDefinitions: merges into the builders package declaration.
    interface MessageContextCommandBuilder {
        toJSON(
            validationOverride?: boolean,
        ): ContextMenuCommandData<ApplicationCommandType.Message>;
    }
}

export type CommandType =
    | ApplicationCommandType.ChatInput
    | ApplicationCommandType.User
    | ApplicationCommandType.Message;

type CommandBuilders = {
    [ApplicationCommandType.ChatInput]: ChatInputCommandBuilder;
    [ApplicationCommandType.User]: UserContextCommandBuilder;
    [ApplicationCommandType.Message]: MessageContextCommandBuilder;
};

type CommandInteractions = {
    [ApplicationCommandType.ChatInput]: ChatInputCommandInteraction;
    [ApplicationCommandType.User]: UserContextMenuCommandInteraction;
    [ApplicationCommandType.Message]: MessageContextMenuCommandInteraction;
};

type CommandDefinition = CommandType | CommandInputDefinition;

type DefinitionCommandType<Definition> = Definition extends CommandType
    ? Definition
    : ApplicationCommandType.ChatInput;

export type CommandOptions<Definition = ApplicationCommandType.ChatInput> = {
    builder: CommandBuilders[DefinitionCommandType<Definition>];
    guards?: readonly GuardProvider<
        CommandContextOf<DefinitionCommandType<Definition>>
    >[];
} & (Definition extends CommandInputDefinition
    ? { input: Definition }
    : { input?: never });

/** The context for a definition the caller built, so it's already valid. */
type CommandContextOf<Definition> = InteractionContext<
    CommandInteractions[DefinitionCommandType<Definition>]
> &
    (Definition extends CommandInputDefinition
        ? { readonly input: CommandInputResult<Definition> }
        : unknown);

export type CommandContext<
    Definition extends CommandDefinition = ApplicationCommandType.ChatInput,
> = CommandContextOf<Definition>;

export type AutocompleteContext = InteractionContext<AutocompleteInteraction>;

type CommandRun<Definition> = (
    ctx: CommandContextOf<Definition>,
) => HandlerResult;
type AutocompleteRun = (ctx: AutocompleteContext) => HandlerResult;

export class Command<Definition = ApplicationCommandType.ChatInput> {
    readonly builder: CommandBuilders[DefinitionCommandType<Definition>];
    readonly commandType: DefinitionCommandType<Definition>;
    readonly guards: readonly GuardProvider<
        CommandContextOf<DefinitionCommandType<Definition>>
    >[];
    readonly input: CommandInputDefinition | undefined;
    // Stored loosely so handlers of different specs stay assignable, as an
    // abstract method's would; run() restores the type.
    readonly #run: ((ctx: never) => HandlerResult) | undefined;

    constructor(
        options: CommandOptions<Definition> & {
            run?: CommandRun<Definition>;
            autocomplete?: AutocompleteRun;
        },
    ) {
        this.builder = options.builder;
        const data = this.builder.toJSON(false);
        const type = data.type ?? ApplicationCommandType.ChatInput;

        if (
            type !== ApplicationCommandType.ChatInput &&
            type !== ApplicationCommandType.User &&
            type !== ApplicationCommandType.Message
        ) {
            throw new TypeError(
                "Command builder must define a chat-input, user, or message command.",
            );
        }

        this.commandType = type as DefinitionCommandType<Definition>;

        this.input = validateCommandInput(
            options.input,
            type === ApplicationCommandType.ChatInput,
        );

        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;

            if (!isGuard(provider)) {
                throw new TypeError(
                    "Command guards must be guards from defineGuard() or guard factories.",
                );
            }
        }

        this.#run = options.run;

        if (options.autocomplete !== undefined) {
            this.autocomplete = options.autocomplete;
        }
    }

    run(ctx: CommandContextOf<Definition>): HandlerResult {
        if (!this.#run) {
            throw new TypeError("Commands must provide a run() method.");
        }

        return this.#run(ctx as never);
    }

    autocomplete?(ctx: AutocompleteContext): HandlerResult;
}

/** The command type a builder makes. */
type BuilderCommandType<Builder> = Builder extends ChatInputCommandBuilder
    ? ApplicationCommandType.ChatInput
    : Builder extends UserContextCommandBuilder
      ? ApplicationCommandType.User
      : ApplicationCommandType.Message;

type CommandBuilder = CommandBuilders[CommandType];

type DefinedCommand<
    Builder,
    Schema extends CommandInputSchema | undefined,
    Result,
    Defer extends boolean,
> = Schema extends CommandInputSchema
    ? InferredInput<
          Schema,
          Result,
          CommandContextOf<ApplicationCommandType.ChatInput>,
          Defer
      >
    : BuilderCommandType<Builder>;

/**
 * Defines a top-level command. The builder decides the command type, and the
 * input and every context type are inferred.
 */
export const defineCommand = <
    Builder extends CommandBuilder,
    Schema extends CommandInputSchema | undefined = undefined,
    Result = NoResolve,
    Defer extends boolean = false,
>(
    options: {
        builder: Builder;
        input?: HandlerInput<
            Schema,
            Result,
            CommandContextOf<ApplicationCommandType.ChatInput>,
            Defer
        >;
        guards?: readonly GuardProvider<
            CommandContextOf<BuilderCommandType<Builder>>
        >[];
        run: CommandRun<DefinedCommand<Builder, Schema, Result, Defer>>;
        autocomplete?: AutocompleteRun;
    } & (BuilderCommandType<Builder> extends ApplicationCommandType.ChatInput
        ? unknown
        : { input?: never; autocomplete?: never }),
): Command<DefinedCommand<Builder, Schema, Result, Defer>> => {
    if (typeof options?.run !== "function") {
        throw new TypeError("Commands must provide a run() function.");
    }

    if (
        options.autocomplete !== undefined &&
        typeof options.autocomplete !== "function"
    ) {
        throw new TypeError("Command autocomplete must be a function.");
    }

    // The options match the inferred definition; TypeScript can't relate the
    // two forms while the type parameters are still generic.
    const command = new Command<DefinedCommand<Builder, Schema, Result, Defer>>(
        options as never,
    );

    Object.freeze(command);

    return command;
};

export type AnyCommand =
    | Command<ApplicationCommandType.ChatInput>
    | Command<ApplicationCommandType.User>
    | Command<ApplicationCommandType.Message>;
