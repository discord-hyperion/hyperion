import type { ClientOptions } from "discord.js";
import type { LoggingOptions } from "../logging/index.ts";
import type { EventRegistryOptions } from "../registries/event-registry.ts";
import type { CommandRegistrationOptions } from "../registries/index.ts";

export interface HyperionClientOptions {
    name: string;
    description?: string;
    discord: ClientOptions;
    /** Bot project root */
    root?: string | URL;
    commands?: CommandRegistrationOptions;
    logging?: LoggingOptions | false;
    events?: EventRegistryOptions;
}
