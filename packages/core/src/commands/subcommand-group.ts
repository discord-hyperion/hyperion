import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import type { Locale } from "discord.js";
import type { GuardProvider } from "../guards/index.ts";
import type { CommandContext } from "./command.ts";
import { freezeCommandGuards } from "./freeze-command-guards.ts";
import type { Subcommand } from "./subcommand.ts";

export type SubcommandGroupOptions = {
    builder: ChatInputCommandSubcommandGroupBuilder;
    guards?: readonly GuardProvider<CommandContext>[];
};

export abstract class SubcommandGroup {
    readonly builder: ChatInputCommandSubcommandGroupBuilder;
    readonly guards: readonly GuardProvider<CommandContext>[];

    protected constructor(options: SubcommandGroupOptions) {
        if (
            !(options.builder instanceof ChatInputCommandSubcommandGroupBuilder)
        ) {
            throw new TypeError(
                "Subcommand groups require a ChatInputCommandSubcommandGroupBuilder.",
            );
        }

        if (options.builder.options.length > 0) {
            throw new TypeError(
                "Subcommand groups cannot define children directly. Define subcommands in files under the group folder.",
            );
        }

        this.builder = options.builder;
        this.guards = freezeCommandGuards(options.guards);
    }

    compose(name: string, subcommands: readonly Subcommand[]) {
        if (this.builder.options.length > 0) {
            throw new TypeError(
                "Subcommand groups cannot define children directly. Define subcommands in files under the group folder.",
            );
        }

        const data = this.builder.toJSON(false);

        if (data.name !== undefined && data.name !== name) {
            throw new TypeError(
                `Group builder name "${data.name}" must match folder name "${name}".`,
            );
        }

        if (subcommands.length === 0) {
            throw new TypeError(
                `Subcommand group "${name}" must contain at least one subcommand.`,
            );
        }

        const builder = new ChatInputCommandSubcommandGroupBuilder()
            .setName(name)
            .setDescription(data.description)
            .addSubcommands(...subcommands.map(command => command.builder));

        // Serialized map types allow nulls that setter types exclude. Preserve
        // the full payload so native validation, including invalid entries, runs.
        if (data.name_localizations) {
            builder.setNameLocalizations(
                data.name_localizations as Partial<Record<Locale, string>>,
            );
        }

        if (data.description_localizations) {
            builder.setDescriptionLocalizations(
                data.description_localizations as Partial<
                    Record<Locale, string>
                >,
            );
        }

        return builder;
    }
}
