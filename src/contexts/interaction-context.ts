import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export interface InteractionContext<
    InteractionType extends
        | ChatInputCommandInteraction
        | ButtonInteraction
        | StringSelectMenuInteraction =
        | ChatInputCommandInteraction
        | ButtonInteraction
        | StringSelectMenuInteraction,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
