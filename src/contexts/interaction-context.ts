import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SelectMenuInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export type AnyInteraction =
    | ChatInputCommandInteraction
    | ButtonInteraction
    | SelectMenuInteraction
    | ModalSubmitInteraction;

export interface InteractionContext<
    InteractionType extends AnyInteraction = AnyInteraction,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
