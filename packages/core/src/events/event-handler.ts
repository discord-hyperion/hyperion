import type { ClientEventTypes } from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";
import type { HandlerResult } from "../components/handler-spec.ts";

export type EventName = keyof ClientEventTypes;

export type EventContext<Event extends EventName> = {
    readonly client: HyperionClient;
    readonly logger: Logger;
    readonly args: Readonly<ClientEventTypes[Event]>;
};

export type EventHandlerOptions = {
    once?: boolean;
};

export class EventHandler<Event extends EventName = EventName> {
    /** The event this handler expects; its folder must match. */
    readonly event: Event | undefined;
    readonly once: boolean;
    // Stored loosely so handlers for different events stay assignable, as an
    // abstract method's would; run() restores the type.
    readonly #run: ((ctx: never) => HandlerResult) | undefined;

    constructor(
        options: EventHandlerOptions & {
            event?: Event;
            run?: (ctx: EventContext<Event>) => HandlerResult;
        } = {},
    ) {
        if (options.once !== undefined && typeof options.once !== "boolean") {
            throw new TypeError("Event handler once must be a boolean.");
        }

        this.event = options.event;
        this.once = options.once ?? false;
        this.#run = options.run;
    }

    run(ctx: EventContext<Event>): HandlerResult {
        if (!this.#run) {
            throw new TypeError("Event handlers must provide a run() method.");
        }

        return this.#run(ctx as never);
    }
}

/**
 * Defines an event handler. `event` types `ctx.args`, and must match the folder
 * the file is in.
 */
export const defineEvent = <const Event extends EventName>(
    options: EventHandlerOptions & {
        event: Event;
        run: (ctx: EventContext<Event>) => HandlerResult;
    },
): EventHandler<Event> => {
    if (typeof options?.event !== "string") {
        throw new TypeError("Event handlers must name their event.");
    }

    if (typeof options.run !== "function") {
        throw new TypeError("Event handlers must provide a run() function.");
    }

    const handler = new EventHandler(options);

    Object.freeze(handler);

    return handler;
};
