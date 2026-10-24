import type { ChatInputCommandBuilder } from "@discordjs/builders";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export interface CommandOptions {
    builder: ChatInputCommandBuilder;
}

export interface CommandContext {
    readonly client: HyperionClient;
    readonly interaction: ChatInputCommandInteraction;
    readonly logger: Logger;
}

export abstract class Command {
    public readonly builder: ChatInputCommandBuilder;

    protected constructor(options: CommandOptions) {
        this.builder = options.builder;
    }

    public abstract run(context: CommandContext): Promise<void>;
}
