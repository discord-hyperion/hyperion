import { type ClientEventTypes, Collection } from "discord.js";
import type { HyperionClient } from "../client/index.ts";
import type { EventName } from "../events/index.ts";
import {
    type LoadedEventHandler,
    loadEventHandlers,
} from "../events/load-event-handlers.ts";

type Occurrence = {
    entries: LoadedEventHandler[];
    args: unknown[];
    complete: () => void;
};

type EventQueue = {
    active: Occurrence | undefined;
    waiting: Occurrence[];
    running: boolean;
    abandoned: boolean;
    idle: Promise<void>;
};

export type EventRegistryOptions = {
    /** Maximum waiting occurrences per event; the active occurrence is excluded. */
    maxPendingPerEvent?: number;
    /** Time allowed for accepted event work to drain during client destruction. */
    shutdownTimeoutMs?: number;
};

export const validateEventOptions = (options: EventRegistryOptions = {}) => {
    const maxPending = options.maxPendingPerEvent ?? 1_000;
    const timeout = options.shutdownTimeoutMs ?? 10_000;

    if (!Number.isSafeInteger(maxPending) || maxPending < 0) {
        throw new TypeError(
            "maxPendingPerEvent must be a nonnegative safe integer.",
        );
    }

    if (!Number.isInteger(timeout) || timeout < 0 || timeout > 2_147_483_647) {
        throw new TypeError(
            "shutdownTimeoutMs must be a nonnegative integer no greater than 2147483647.",
        );
    }
};

export class EventRegistry {
    private definitions = new Collection<EventName, LoadedEventHandler[]>();
    private readonly listeners = new Collection<
        EventName,
        (...args: unknown[]) => Promise<void>
    >();
    private readonly queues = new Collection<EventName, EventQueue>();
    private readonly maxPendingPerEvent: number;
    private readonly shutdownTimeoutMs: number;
    private loading = Promise.resolve();
    private stopping = false;
    private closing: Promise<void> | undefined;

    constructor(
        private readonly client: HyperionClient,
        private readonly root: string | URL = process.cwd(),
        options: EventRegistryOptions = {},
    ) {
        validateEventOptions(options);

        this.maxPendingPerEvent = options.maxPendingPerEvent ?? 1_000;
        this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 10_000;
    }

    get size() {
        return [...this.definitions.values()].reduce(
            (count, entries) => count + entries.length,
            0,
        );
    }

    load() {
        const pending = this.loading.then(() => this.replace());
        this.loading = pending.catch(() => {});

        return pending;
    }

    private async replace() {
        if (this.stopping) {
            throw new Error(
                "Cannot load event handlers after shutdown has started.",
            );
        }

        const definitions = await loadEventHandlers(
            this.root,
            this.client.logger,
        );

        if (this.stopping) {
            throw new Error(
                "Cannot load event handlers after shutdown has started.",
            );
        }

        const added = new Collection<
            EventName,
            (...args: unknown[]) => Promise<void>
        >();

        try {
            for (const event of definitions.keys()) {
                if (this.listeners.has(event)) continue;

                const listener = (...args: unknown[]) =>
                    this.enqueue(event, args);

                this.client.on(event, listener);
                added.set(event, listener);
            }
        } catch (error) {
            for (const [event, listener] of added) {
                this.client.off(event, listener);
            }

            throw error;
        }

        this.definitions = definitions;

        for (const [event, listener] of this.listeners) {
            if (!definitions.has(event)) {
                this.client.off(event, listener);
                this.listeners.delete(event);
            }
        }

        for (const [event, listener] of added) {
            this.listeners.set(event, listener);
        }

        this.client.logger.info(
            { event: "events.loaded", count: this.size },
            "Event handler discovery complete",
        );
    }

    private enqueue(event: EventName, args: unknown[]) {
        if (this.stopping) return Promise.resolve();

        const entries =
            this.definitions.get(event)?.filter(entry => !entry.consumed) ?? [];

        if (entries.length === 0) return Promise.resolve();

        let queue = this.queues.get(event);

        if (!queue) {
            queue = {
                active: undefined,
                waiting: [],
                running: false,
                abandoned: false,
                idle: Promise.resolve(),
            };

            this.queues.set(event, queue);
        }

        if (queue.running && queue.waiting.length >= this.maxPendingPerEvent) {
            this.client.logger.warn(
                {
                    event: "event.queue.full",
                    eventName: event,
                    queueCount: queue.waiting.length,
                },
                "Discarded newest event occurrence",
            );

            return Promise.resolve();
        }

        for (const entry of entries) {
            if (entry.handler.once) entry.consumed = true;
        }

        return new Promise<void>(complete => {
            const occurrence = { entries, args, complete };

            if (queue.running) {
                queue.waiting.push(occurrence);
            } else {
                queue.running = true;
                queue.active = occurrence;
                // Publish the drain promise before invoking any application code.
                queue.idle = Promise.resolve().then(() =>
                    this.drain(event, queue),
                );
            }
        });
    }

    private async drain(event: EventName, queue: EventQueue) {
        try {
            while (queue.active && !queue.abandoned) {
                const occurrence = queue.active;

                try {
                    for (const entry of occurrence.entries) {
                        if (queue.abandoned) break;

                        const logger = this.client.logger.child({
                            eventName: event,
                            source: entry.source,
                            priority: entry.priority,
                        });

                        try {
                            await entry.handler.run({
                                client: this.client,
                                logger,
                                args: occurrence.args as ClientEventTypes[EventName],
                            });
                        } catch (err) {
                            logger.error(
                                { event: "event.failed", err },
                                "Event handler failed",
                            );
                        }
                    }
                } finally {
                    occurrence.complete();
                }

                queue.active = queue.abandoned
                    ? undefined
                    : queue.waiting.shift();
            }
        } finally {
            queue.active?.complete();
            queue.active = undefined;
            queue.running = false;
        }
    }

    /** @internal Managed by HyperionClient.destroy(). */
    shutdown() {
        this.closing ??= this.close();

        return this.closing;
    }

    private async close() {
        this.stopping = true;

        for (const [event, listener] of this.listeners) {
            this.client.off(event, listener);
        }

        this.listeners.clear();
        this.definitions.clear();

        const queues = [...this.queues.values()];
        let timeout: ReturnType<typeof setTimeout> | undefined;

        try {
            await Promise.race([
                Promise.all(queues.map(queue => queue.idle)),
                new Promise<void>(resolve => {
                    timeout = setTimeout(resolve, this.shutdownTimeoutMs);
                }),
            ]);
        } finally {
            if (timeout) clearTimeout(timeout);

            let waiting = 0;
            let active = 0;

            for (const queue of queues) {
                queue.abandoned = true;

                if (queue.running) active++;

                for (const occurrence of queue.waiting.splice(0)) {
                    waiting++;
                    occurrence.complete();
                }
            }

            this.queues.clear();

            if (active || waiting) {
                this.client.logger.warn(
                    {
                        event: "events.shutdown.timeout",
                        activeCount: active,
                        queueCount: waiting,
                    },
                    "Event drain deadline reached",
                );
            }
        }
    }
}
