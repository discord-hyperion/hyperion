import { Client, Events, Team } from "discord.js";
import type { Logger } from "pino";
import { InteractionDispatcher } from "../execution/index.ts";
import { LogManager } from "../logging/index.ts";
import { validateEventOptions } from "../registries/event-registry.ts";
import {
    ButtonRegistry,
    CommandRegistry,
    EventRegistry,
    ModalRegistry,
    SelectMenuRegistry,
} from "../registries/index.ts";
import type { HyperionClientOptions } from "./options.ts";

export class HyperionClient extends Client {
    public readonly name: string;
    public readonly description: string;
    public readonly commands: CommandRegistry;
    public readonly buttons: ButtonRegistry;
    public readonly selectMenus: SelectMenuRegistry;
    readonly modals: ModalRegistry;
    readonly events: EventRegistry;
    public readonly logger: Logger;
    private readonly logging: LogManager;
    private readonly dispatcher: InteractionDispatcher;
    private destruction: Promise<void> | undefined;
    private ownerLookup: Promise<string> | undefined;

    private constructor(options: HyperionClientOptions) {
        super(options.discord);

        this.name = options.name;
        this.description = options.description ?? "";

        this.logging = new LogManager(this.name, options.logging);
        this.logger = this.logging.logger;

        this.commands = new CommandRegistry(
            this.logger.child({ component: "commands" }),
        );
        this.buttons = new ButtonRegistry(
            this.logger.child({ component: "buttons" }),
        );
        this.selectMenus = new SelectMenuRegistry(
            this.logger.child({ component: "select-menus" }),
        );
        this.modals = new ModalRegistry(
            this.logger.child({ component: "modals" }),
        );
        this.events = new EventRegistry(this, options.root, options.events);
        this.dispatcher = new InteractionDispatcher(this);

        this.once(Events.ClientReady, async client => {
            this.logger.info(
                { event: "client.ready", userId: client.user.id },
                "Discord client ready",
            );

            // Fetch eagerly; guards share this request if a click arrives meanwhile.
            // The lookup logs failures and a later guard can retry them.
            await this.getOwnerId().catch(() => undefined);
        });
    }

    public static async create(options: HyperionClientOptions) {
        validateEventOptions(options.events);
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

    private async init(options: HyperionClientOptions) {
        const started = performance.now();

        if (options.commands) {
            await this.logging.step("Loading commands", "commands.load", () =>
                this.commands.load(options.root),
            );
        }

        await this.logging.step("Loading buttons", "buttons.load", () =>
            this.buttons.load(options.root),
        );

        await this.logging.step(
            "Loading select menus",
            "select-menus.load",
            () => this.selectMenus.load(options.root),
        );

        await this.logging.step("Loading modals", "modals.load", () =>
            this.modals.load(options.root),
        );

        if (options.commands) {
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
        await this.logging.step("Loading events", "events.load", () =>
            this.events.load(),
        );

        this.logger.info(
            {
                event: "client.initialized",
                commandCount: this.commands.size,
                buttonCount: this.buttons.size,
                selectMenuCount: this.selectMenus.size,
                modalCount: this.modals.size,
                eventHandlerCount: this.events.size,
                durationMs: Math.round(performance.now() - started),
            },
            "Hyperion initialized",
        );
    }

    public override async login(token?: string) {
        this.ownerLookup = undefined;

        return this.logging.step("Connecting to Discord", "client.login", () =>
            super.login(token),
        );
    }

    async getOwnerId() {
        if (!this.application) {
            throw new Error(
                "Application ownership is unavailable before the bot has logged in.",
            );
        }

        if (!this.ownerLookup) {
            const application = this.application;
            const pending = this.logging.step(
                "Fetching application owner",
                "application.owner",
                async () => {
                    const { owner } = await application.fetch();
                    const ownerId =
                        owner instanceof Team ? owner.ownerId : owner?.id;

                    if (!ownerId) {
                        throw new Error(
                            "Discord did not return an application owner.",
                        );
                    }

                    return ownerId;
                },
            );

            this.ownerLookup = pending;
            void pending.catch(() => {
                if (this.ownerLookup === pending) this.ownerLookup = undefined;
            });
        }

        return this.ownerLookup;
    }

    public override async destroy() {
        this.destruction ??= this.cleanup();
        await this.destruction;
    }

    private async cleanup() {
        this.ownerLookup = undefined;
        try {
            await this.events.shutdown();
        } finally {
            await super.destroy();
        }
    }
}
