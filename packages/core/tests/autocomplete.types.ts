import type {
    ApplicationCommandOptionChoiceData,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
} from "discord.js";
import type {
    AnyInteraction,
    AutocompleteContext,
    Command,
    CommandContext,
    InteractionContext,
} from "../src/index.ts";

export const autocompleteContracts = (
    ctx: AutocompleteContext,
    commandCtx: CommandContext,
    defaultCtx: InteractionContext,
    command: Command,
) => {
    ctx.interaction satisfies AutocompleteInteraction;
    ctx.interaction satisfies AnyInteraction;
    ctx.interaction.options.getFocused() satisfies AutocompleteFocusedOption;
    ctx.interaction.options.getFocused().value satisfies string;
    ctx.interaction.respond satisfies (
        choices: readonly ApplicationCommandOptionChoiceData[],
    ) => Promise<void>;
    command.autocomplete satisfies
        | ((ctx: AutocompleteContext) => void | Promise<void>)
        | undefined;
    defaultCtx.interaction.reply;

    // @ts-expect-error Autocomplete cannot use normal interaction replies.
    ctx.interaction.reply;
    // @ts-expect-error Autocomplete cannot defer its response.
    ctx.interaction.deferReply;
    // @ts-expect-error Commands cannot respond with autocomplete suggestions.
    commandCtx.interaction.respond;
    // @ts-expect-error v15 getFocused takes no boolean argument.
    ctx.interaction.options.getFocused(true);
    // @ts-expect-error The default executable context excludes autocomplete.
    const executable: InteractionContext = ctx;

    return executable;
};
