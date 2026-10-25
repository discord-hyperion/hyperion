import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export interface InteractionContext<
    InteractionType extends
        | ChatInputCommandInteraction
        | ButtonInteraction
        | StringSelectMenuInteraction
        | UserSelectMenuInteraction =
        | ChatInputCommandInteraction
        | ButtonInteraction
        | StringSelectMenuInteraction
        | UserSelectMenuInteraction,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
