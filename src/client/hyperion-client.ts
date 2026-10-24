import { Client } from "discord.js";
import { CommandRegistry } from "../registries/index.ts";
import type { HyperionClientOptions } from "./options.ts";

export class HyperionClient extends Client {
    public readonly name: string;
    public readonly description: string;
    public readonly ownerIds: readonly string[];
    public readonly commands: CommandRegistry;

    private constructor(options: HyperionClientOptions) {
        super(options.discord);

        this.name = options.name;
        this.description = options.description ?? "";
        this.ownerIds = Object.freeze([...(options.ownerIds ?? [])]);

        this.commands = new CommandRegistry();
    }

    public static async create(
        options: HyperionClientOptions,
    ): Promise<HyperionClient> {
        const client = new HyperionClient(options);

        try {
            await client.init(options);
            return client;
        } catch (error) {
            client.destroy();
            throw error;
        }
    }

    private async init(options: HyperionClientOptions): Promise<void> {
        if (!options.commands) return;

        await this.commands.load(options.root);

        if (this.commands.size === 0) return;

        await this.commands.register(options.commands);
    }
}
