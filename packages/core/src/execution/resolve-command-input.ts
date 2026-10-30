import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import type {
    Command,
    CommandContext,
    CommandInputOptions,
    CommandInputResolver,
    CommandInputResult,
    Subcommand,
} from "../commands/index.ts";

/** Resolve one invocation without changing the shared handler definition. */
export const resolveCommandInput = async (
    command: Command | Subcommand,
    ctx: CommandContext,
): Promise<CommandInputResult<CommandInputOptions> | undefined> => {
    if (!command.input) return undefined;

    const { interaction } = ctx;
    if (command.input.defer && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

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

    const result = await command.input.schema["~standard"].validate(input);
    if (result.issues !== undefined) return [result.issues, undefined];

    // Definitions erase callback argument types for heterogeneous registries.
    // Validation establishes the schema output before crossing this boundary.
    const value = command.input.resolve
        ? await (command.input.resolve as CommandInputResolver)(
              result.value,
              ctx,
          )
        : result.value;
    return [null, value];
};
