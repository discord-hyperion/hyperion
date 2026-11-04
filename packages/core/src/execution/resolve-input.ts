import { MessageFlags } from "discord.js";
import type {
    CommandInputDefinition,
    CommandInputResolver,
    CommandInputResult,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";

/** Apply shared input policy after guards, before invoking a handler. */
export const resolveInput = async <Context extends InteractionContext>(
    definition: CommandInputDefinition<Context>,
    ctx: Context,
    extract: () => Record<string, unknown>,
): Promise<CommandInputResult<CommandInputDefinition<Context>>> => {
    const { interaction } = ctx;

    if (definition.defer && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const result = await definition.schema["~standard"].validate(extract());
    if (result.issues !== undefined) return [result.issues, undefined];

    // Heterogeneous registries erase callback argument types. Validation
    // establishes schema output before crossing this boundary.
    const value = definition.resolve
        ? await (
              definition.resolve as CommandInputResolver<
                  unknown,
                  unknown,
                  Context
              >
          )(result.value, ctx)
        : result.value;

    return [null, value];
};
