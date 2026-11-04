import { MessageFlags } from "discord.js";
import type {
    CommandInputDefinition,
    CommandInputResolver,
    CommandInputResult,
    InputDefer,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";

const defer = async (
    interaction: InteractionContext["interaction"],
    mode: InputDefer | undefined,
) => {
    if (!mode || interaction.deferred || interaction.replied) return;

    if (mode !== "update") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        return;
    }

    if (interaction.isMessageComponent()) {
        await interaction.deferUpdate();

        return;
    }

    if (interaction.isModalSubmit() && interaction.isFromMessage()) {
        await interaction.deferUpdate();

        return;
    }

    throw new TypeError(
        'Input defer: "update" needs an interaction from a message, such as a component or a modal it opened.',
    );
};

/** Apply shared input policy after guards, before invoking a handler. */
export const resolveInput = async <Context extends InteractionContext>(
    definition: CommandInputDefinition<Context, InputDefer>,
    ctx: Context,
    extract: () => unknown,
): Promise<CommandInputResult<CommandInputDefinition<Context, InputDefer>>> => {
    await defer(ctx.interaction, definition.defer);

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
