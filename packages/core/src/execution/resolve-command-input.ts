import { ApplicationCommandOptionType } from "discord.js";
import type {
    Command,
    CommandContext,
    CommandInputOptions,
    CommandInputResult,
    Subcommand,
} from "../commands/index.ts";

import { resolveInput } from "./resolve-input.ts";

/** Resolve one invocation without changing the shared handler definition. */
export const resolveCommandInput = async (
    command: Command | Subcommand,
    ctx: CommandContext,
): Promise<CommandInputResult<CommandInputOptions> | undefined> => {
    if (!command.input) return undefined;

    return resolveInput(command.input, ctx, () => {
        const { interaction } = ctx;
        const options = command.builder.toJSON(false).options ?? [];
        const input: Record<string, unknown> = Object.fromEntries(
            options.map(option => [option.name, undefined]),
        );

        for (const option of options) {
            const supplied = interaction.options.get(option.name);
            if (!supplied) continue;

            const value =
                option.type === ApplicationCommandOptionType.Attachment
                    ? interaction.options.getAttachment(option.name, true)
                    : supplied.value;
            input[option.name] = value;
        }

        return input;
    });
};
