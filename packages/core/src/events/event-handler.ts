import type { ClientEventTypes } from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";

export type EventName = keyof ClientEventTypes;

export type EventContext<Event extends EventName> = {
    readonly client: HyperionClient;
    readonly logger: Logger;
    readonly args: Readonly<ClientEventTypes[Event]>;
};

export type EventHandlerOptions = {
    once?: boolean;
};

export abstract class EventHandler<Event extends EventName = EventName> {
    readonly once: boolean;

    constructor(options: EventHandlerOptions = {}) {
        if (options.once !== undefined && typeof options.once !== "boolean") {
            throw new TypeError("Event handler once must be a boolean.");
        }

        this.once = options.once ?? false;
    }

    abstract run(ctx: EventContext<Event>): Promise<void>;
}
