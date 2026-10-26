import type { ChatInputCommandBuilder } from "@discordjs/builders";
import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
} from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export interface CommandOptions {
    builder: ChatInputCommandBuilder;
    guards?: readonly GuardProvider[];
}

export interface CommandContext
    extends InteractionContext<ChatInputCommandInteraction> {}

export interface AutocompleteContext
    extends InteractionContext<AutocompleteInteraction> {}

export abstract class Command {
    public readonly builder: ChatInputCommandBuilder;
    public readonly guards: readonly GuardProvider[];

    protected constructor(options: CommandOptions) {
        this.builder = options.builder;
        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Command guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    public abstract run(ctx: CommandContext): Promise<void>;

    autocomplete?(ctx: AutocompleteContext): Promise<void>;
}
