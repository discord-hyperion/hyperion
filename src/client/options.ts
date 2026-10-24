import type { ClientOptions } from "discord.js";
import type { CommandRegistrationOptions } from "../registries/index.ts";

export interface HyperionClientOptions {
    name: string;
    description?: string;
    discord: ClientOptions;
    ownerIds?: readonly string[];
    /** Bot project root; handler directories are resolved beneath root/src. */
    root?: string | URL;
    commands?: CommandRegistrationOptions;
}
