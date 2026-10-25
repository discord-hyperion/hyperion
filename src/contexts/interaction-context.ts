import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export interface InteractionContext<
    InteractionType extends ChatInputCommandInteraction | ButtonInteraction =
        | ChatInputCommandInteraction
        | ButtonInteraction,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
