import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import type { GuardProvider } from "../guards/index.ts";
import type { AutocompleteContext, CommandContext } from "./command.ts";
import { freezeCommandGuards } from "./freeze-command-guards.ts";

export type SubcommandOptions = {
    builder: ChatInputCommandSubcommandBuilder;
    guards?: readonly GuardProvider<CommandContext>[];
};

export abstract class Subcommand {
    readonly builder: ChatInputCommandSubcommandBuilder;
    readonly guards: readonly GuardProvider<CommandContext>[];

    protected constructor(options: SubcommandOptions) {
        if (!(options.builder instanceof ChatInputCommandSubcommandBuilder)) {
            throw new TypeError(
                "Subcommands require a ChatInputCommandSubcommandBuilder.",
            );
        }

        this.builder = options.builder;
        this.guards = freezeCommandGuards(options.guards);
    }

    abstract run(ctx: CommandContext): Promise<void>;

    autocomplete?(ctx: AutocompleteContext): Promise<void>;
}
