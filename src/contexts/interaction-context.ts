import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    SelectMenuInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export type AnyInteraction =
    | ChatInputCommandInteraction
    | ButtonInteraction
    | SelectMenuInteraction;

export interface InteractionContext<
    InteractionType extends AnyInteraction = AnyInteraction,
> {
    readonly client: HyperionClient;
    readonly interaction: InteractionType;
    readonly logger: Logger;
}
