import { Client, Events } from "discord.js";
import type { Logger } from "pino";
import { InteractionDispatcher } from "../execution/index.ts";
import { LogManager } from "../logging/index.ts";
import { CommandRegistry } from "../registries/index.ts";
import type { HyperionClientOptions } from "./options.ts";

export class HyperionClient extends Client {
    public readonly name: string;
    public readonly description: string;
    public readonly ownerIds: readonly string[];
    public readonly commands: CommandRegistry;
    public readonly logger: Logger;
    private readonly logging: LogManager;
    private readonly dispatcher: InteractionDispatcher;

    private constructor(options: HyperionClientOptions) {
        super(options.discord);

        this.name = options.name;
        this.description = options.description ?? "";
        this.ownerIds = Object.freeze([...(options.ownerIds ?? [])]);

        this.logging = new LogManager(this.name, options.logging);
        this.logger = this.logging.logger;
        this.commands = new CommandRegistry(
            this.logger.child({ component: "commands" }),
        );
        this.dispatcher = new InteractionDispatcher(this);
        this.once(Events.ClientReady, client => {
            this.logger.info(
                { event: "client.ready", userId: client.user.id },
                "Discord client ready",
            );
        });
    }

    public static async create(
        options: HyperionClientOptions,
    ): Promise<HyperionClient> {
        const client = new HyperionClient(options);

        try {
            await client.init(options);
            return client;
        } catch (error) {
            try {
                await client.destroy();
            } catch (err) {
                client.logger.error(
                    { event: "client.cleanup.failed", err },
                    "Client cleanup failed",
                );
            }
            throw error;
        }
    }

    private async init(options: HyperionClientOptions): Promise<void> {
        const started = performance.now();

        if (options.commands) {
            await this.logging.step("Loading commands", "commands.load", () =>
                this.commands.load(options.root),
            );

            if (this.commands.size > 0) {
                const registration = options.commands;

                await this.logging.step(
                    "Registering application commands",
                    "commands.register",
                    () => this.commands.register(registration),
                );
            } else {
                this.logger.info(
                    { event: "commands.register.skipped" },
                    "No commands found; skipping deployment",
                );
            }
        }

        this.dispatcher.attach();

        this.logger.info(
            {
                event: "client.initialized",
                commandCount: this.commands.size,
                durationMs: Math.round(performance.now() - started),
            },
            "Hyperion initialized",
        );
    }

    public override async login(token?: string): Promise<string> {
        return this.logging.step("Connecting to Discord", "client.login", () =>
            super.login(token),
        );
    }
}
