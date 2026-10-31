import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Collection, Events } from "discord.js";
import type { Logger } from "pino";
import {
    discoverHandlerFiles,
    loadHandler,
} from "../registries/load-modules.ts";
import { EventHandler, type EventName } from "./event-handler.ts";

export type LoadedEventHandler = {
    handler: EventHandler;
    source: string;
    priority: number | undefined;
    consumed: boolean;
};

const require = createRequire(import.meta.url);
const eventNames: ReadonlySet<string> = new Set(Object.values(Events));
const isEventName = (name: string): name is EventName => eventNames.has(name);

export const loadEventHandlers = async (root: string | URL, logger: Logger) => {
    const { directory, files } = await discoverHandlerFiles(
        root,
        "events",
        logger,
    );

    const groups = new Collection<EventName, LoadedEventHandler[]>();

    for (const file of files) {
        const relative = path.relative(directory, file);
        const event = relative.split(path.sep)[0];

        if (!event || relative === event || !isEventName(event)) {
            throw new Error(
                `Event handler "${file}" must be inside a folder named after a Discord client event.`,
            );
        }

        const match = /^(\d+)-(.+)\.(?:[cm]?[jt]s|[jt]sx)$/.exec(
            path.basename(file),
        );
        const priority = match ? Number(match[1]) : undefined;

        if (priority !== undefined && !Number.isSafeInteger(priority)) {
            throw new Error(
                `Event handler priority in "${file}" must be a safe nonnegative integer.`,
            );
        }

        const entries = groups.get(event) ?? [];
        const duplicate =
            priority === undefined
                ? undefined
                : entries.find(entry => entry.priority === priority);

        if (duplicate) {
            throw new Error(
                `Duplicate priority ${priority} for event "${event}" in "${duplicate.source}" and "${relative}".`,
            );
        }

        let handler: EventHandler;

        try {
            // Refresh only entry modules. Shared SDK/framework imports retain their identity.
            delete require.cache[require.resolve(file)];
            const url = pathToFileURL(file);
            url.searchParams.set("hyperion-load", randomUUID());
            handler = await loadHandler(file, EventHandler, url);

            if (typeof handler.run !== "function") {
                throw new TypeError(
                    "Event handlers must provide a run() method.",
                );
            }

            if (typeof handler.once !== "boolean") {
                throw new TypeError("Event handler once must be a boolean.");
            }
        } catch (cause) {
            throw new Error(`Failed to load event handler from "${file}".`, {
                cause,
            });
        }

        entries.push({ handler, source: relative, priority, consumed: false });
        groups.set(event, entries);
    }

    for (const entries of groups.values()) {
        entries.sort((left, right) => {
            if (left.priority === undefined && right.priority !== undefined)
                return 1;
            if (left.priority !== undefined && right.priority === undefined)
                return -1;

            return (
                (left.priority ?? 0) - (right.priority ?? 0) ||
                (left.source < right.source
                    ? -1
                    : left.source > right.source
                      ? 1
                      : 0)
            );
        });
    }

    return groups;
};
