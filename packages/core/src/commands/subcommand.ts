import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import type { ApplicationCommandType } from "discord.js";
import type { GuardProvider } from "../guards/index.ts";
import type { AutocompleteContext, CommandContext } from "./command.ts";
import type { CommandInputDefinition } from "./command-input.ts";
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

export abstract class Subcommand<
    Input extends CommandInputDefinition | undefined = undefined,
> {
    readonly builder: ChatInputCommandSubcommandBuilder;
    readonly guards: readonly GuardProvider<CommandContext>[];
    readonly input: CommandInputDefinition | undefined;

    protected constructor(options: SubcommandOptions<Input>) {
        if (!(options.builder instanceof ChatInputCommandSubcommandBuilder)) {
            throw new TypeError(
                "Subcommands require a ChatInputCommandSubcommandBuilder.",
            );
        }

        this.builder = options.builder;

        this.input = validateCommandInput(options.input);
        this.guards = freezeCommandGuards(options.guards);
    }

    abstract run(
        ctx: CommandContext<
            Input extends CommandInputDefinition
                ? Input
                : ApplicationCommandType.ChatInput
        >,
    ): Promise<void>;

    autocomplete?(ctx: AutocompleteContext): Promise<void>;
}
