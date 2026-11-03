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
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import type {
    CommandInputDefinition,
    CommandInputResult,
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

type DefinitionCommandType<Definition extends CommandDefinition> =
    Definition extends CommandType
        ? Definition
        : ApplicationCommandType.ChatInput;

export type CommandOptions<
    Definition extends CommandDefinition = ApplicationCommandType.ChatInput,
> = {
    builder: CommandBuilders[DefinitionCommandType<Definition>];
    guards?: readonly GuardProvider<
        CommandContext<DefinitionCommandType<Definition>>
    >[];
} & (Definition extends CommandInputDefinition
    ? { input: Definition }
    : { input?: never });

export type CommandContext<
    Definition extends CommandDefinition = ApplicationCommandType.ChatInput,
> = InteractionContext<CommandInteractions[DefinitionCommandType<Definition>]> &
    (Definition extends CommandInputDefinition
        ? { readonly input: CommandInputResult<Definition> }
        : unknown);

export type AutocompleteContext = InteractionContext<AutocompleteInteraction>;

export abstract class Command<
    Definition extends CommandDefinition = ApplicationCommandType.ChatInput,
> {
    readonly builder: CommandBuilders[DefinitionCommandType<Definition>];
    readonly commandType: DefinitionCommandType<Definition>;
    readonly guards: readonly GuardProvider<
        CommandContext<DefinitionCommandType<Definition>>
    >[];
    readonly input: CommandInputDefinition | undefined;

    protected constructor(options: CommandOptions<Definition>) {
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
    }

    abstract run(ctx: CommandContext<Definition>): Promise<void>;

    autocomplete?(ctx: AutocompleteContext): Promise<void>;
}

export type AnyCommand =
    | Command<ApplicationCommandType.ChatInput>
    | Command<ApplicationCommandType.User>
    | Command<ApplicationCommandType.Message>;
