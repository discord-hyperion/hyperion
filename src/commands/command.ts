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
import { Guard, type GuardProvider } from "../guards/index.ts";

type ContextMenuCommandData<
    Type extends ApplicationCommandType.User | ApplicationCommandType.Message,
> = ReturnType<ContextMenuCommandBuilder["toJSON"]> & { type: Type };

declare module "@discordjs/builders" {
    interface UserContextCommandBuilder {
        toJSON(
            validationOverride?: boolean,
        ): ContextMenuCommandData<ApplicationCommandType.User>;
    }

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

export type CommandOptions<
    Type extends CommandType = ApplicationCommandType.ChatInput,
> = {
    builder: CommandBuilders[Type];
    guards?: readonly GuardProvider<CommandContext<Type>>[];
};

export type CommandContext<
    Type extends CommandType = ApplicationCommandType.ChatInput,
> = InteractionContext<CommandInteractions[Type]>;

export type AutocompleteContext = InteractionContext<AutocompleteInteraction>;

export abstract class Command<
    Type extends CommandType = ApplicationCommandType.ChatInput,
> {
    readonly builder: CommandBuilders[Type];
    readonly commandType: Type;
    readonly guards: readonly GuardProvider<CommandContext<Type>>[];

    protected constructor(options: CommandOptions<Type>) {
        this.builder = options.builder;
        const type =
            this.builder.toJSON(false).type ?? ApplicationCommandType.ChatInput;

        if (
            type !== ApplicationCommandType.ChatInput &&
            type !== ApplicationCommandType.User &&
            type !== ApplicationCommandType.Message
        ) {
            throw new TypeError(
                "Command builder must define a chat-input, user, or message command.",
            );
        }

        this.commandType = type as Type;
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Command guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: CommandContext<Type>): Promise<void>;

    autocomplete?(ctx: AutocompleteContext): Promise<void>;
}

export type AnyCommand =
    | Command<ApplicationCommandType.ChatInput>
    | Command<ApplicationCommandType.User>
    | Command<ApplicationCommandType.Message>;
