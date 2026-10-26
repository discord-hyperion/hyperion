import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction,
    UserContextMenuCommandInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export type AnyInteraction =
    | AutocompleteInteraction
    | ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction
    | ButtonInteraction
    | SelectMenuInteraction
    | ModalSubmitInteraction;

export interface InteractionContext<
    InteractionType extends AnyInteraction = Exclude<
        AnyInteraction,
        AutocompleteInteraction
    >,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
