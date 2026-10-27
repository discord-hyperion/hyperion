import { ChatInputCommandBuilder } from "@discordjs/builders";
import type { GuardProvider } from "../guards/index.ts";
import type { CommandContext } from "./command.ts";
import { freezeCommandGuards } from "./freeze-command-guards.ts";
import type { Subcommand } from "./subcommand.ts";

export type ParentCommandOptions = {
    builder: ChatInputCommandBuilder;
    guards?: readonly GuardProvider<CommandContext>[];
};

export abstract class ParentCommand {
    readonly builder: ChatInputCommandBuilder;
    readonly guards: readonly GuardProvider<CommandContext>[];

    protected constructor(options: ParentCommandOptions) {
        if (!(options.builder instanceof ChatInputCommandBuilder)) {
            throw new TypeError(
                "Parent commands require a ChatInputCommandBuilder.",
            );
        }
        if (options.builder.options.length > 0) {
            throw new TypeError(
                "Parent commands cannot define options or subcommands directly. Define subcommands in files under the parent folder.",
            );
        }

        this.builder = options.builder;
        this.guards = freezeCommandGuards(options.guards);
    }

    serialize(
        name: string,
        subcommands: readonly Subcommand[],
        validate = true,
    ) {
        if (this.builder.options.length > 0) {
            throw new TypeError(
                "Parent commands cannot define options or subcommands directly. Define subcommands in files under the parent folder.",
            );
        }

        const configuredName = this.builder.toJSON(false).name;

        if (configuredName !== undefined && configuredName !== name) {
            throw new TypeError(
                `Parent builder name "${configuredName}" must match folder name "${name}".`,
            );
        }
        if (subcommands.length === 0) {
            throw new TypeError(
                `Parent command "${name}" must contain at least one subcommand.`,
            );
        }

        this.builder.setName(name);

        try {
            this.builder.addSubcommands(
                ...subcommands.map(subcommand => subcommand.builder),
            );
            return this.builder.toJSON(validate);
        } finally {
            this.builder.spliceOptions(0, this.builder.options.length);
        }
    }
}
