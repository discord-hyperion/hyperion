import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import {
    assertRegistryClass,
    type RegistryBaseClass,
} from "../util/assert-registry-class.ts";
import { discoverModules } from "../util/discover-modules.ts";

type HandlerFolder =
    | "commands"
    | "buttons"
    | "select-menus"
    | "modals"
    | "events";

export const discoverHandlerFiles = async (
    root: string | URL,
    folder: HandlerFolder,
    logger?: Logger,
    includeIndexes = false,
) => {
    const rootPath =
        root instanceof URL ? fileURLToPath(root) : path.resolve(root);
    const directory = path.join(rootPath, "src", folder);
    const name = folder.slice(0, -1).replaceAll("-", " ");

    logger?.debug(
        { event: `${folder}.discover`, directory },
        `Discovering ${name} files`,
    );

    const files = await discoverModules(
        directory,
        () => {
            logger?.debug(
                { event: `${folder}.directory.missing`, directory },
                `Optional ${name} directory does not exist`,
            );
        },
        { includeIndexes },
    );

    return { directory, files };
};

export const loadHandler = async <Instance>(
    file: string,
    baseClass: RegistryBaseClass<Instance>,
    url = pathToFileURL(file),
) => {
    const module = await import(url.href);
    const HandlerClass = module.default;

    assertRegistryClass(HandlerClass, baseClass);

    return new HandlerClass();
};

type ComponentData = { custom_id?: string; type?: number };
type ComponentHandler = {
    readonly customId: string;
    readonly builder?: { toJSON: () => ComponentData } | undefined;
    readonly params?: { readonly id: string } | undefined;
    run: unknown;
};

export const loadComponentHandlers = async <Instance extends ComponentHandler>(
    registry: Collection<string, Instance>,
    root: string | URL,
    folder: Exclude<HandlerFolder, "commands" | "events">,
    baseClass: RegistryBaseClass<Instance>,
    validate: (handler: Instance, data: ComponentData) => void,
    logger?: Logger,
    routes?: Collection<string, Instance>,
) => {
    const { files } = await discoverHandlerFiles(root, folder, logger);
    const name = folder.slice(0, -1).replaceAll("-", " ");
    const title = `${name[0]?.toUpperCase()}${name.slice(1)}`;
    const event = folder.slice(0, -1);
    const key = folder === "select-menus" ? "selectMenu" : event;
    const handlers = new Collection<string, Instance>();
    const routed = new Collection<string, Instance>();

    for (const file of files) {
        let handler: Instance;

        try {
            handler = await loadHandler(file, baseClass);

            if (typeof handler.run !== "function") {
                throw new TypeError(
                    `${baseClass.name} handlers must provide a run() method.`,
                );
            }

            if (handler.params === undefined) {
                const data = handler.builder?.toJSON();
                if (!data) {
                    throw new TypeError(
                        `${baseClass.name} handlers require a builder.`,
                    );
                }

                validate(handler, data);

                if (data.custom_id !== handler.customId) {
                    throw new Error(
                        `${baseClass.name} builder custom ID must match its handler's custom ID.`,
                    );
                }
            } else if (!routes) {
                throw new TypeError(
                    `${baseClass.name} handlers do not support params.`,
                );
            }
        } catch (cause) {
            throw new Error(`Failed to load ${name} from "${file}".`, {
                cause,
            });
        }

        if (handler.params !== undefined) {
            if (routed.has(handler.customId)) {
                throw new Error(
                    `Duplicate ${name} route "${handler.customId}" in "${file}".`,
                );
            }

            routed.set(handler.customId, handler);
        } else {
            if (handlers.has(handler.customId)) {
                throw new Error(
                    `Duplicate ${name} custom ID "${handler.customId}" in "${file}".`,
                );
            }

            handlers.set(handler.customId, handler);
        }

        logger?.debug(
            { event: `${event}.loaded`, [key]: handler.customId, source: file },
            `Loaded ${name}`,
        );
    }

    for (const route of routed.keys()) {
        if (handlers.has(route)) {
            throw new Error(
                `${title} route "${route}" collides with a literal custom ID.`,
            );
        }
    }

    registry.clear();
    routes?.clear();

    for (const [customId, handler] of handlers) {
        registry.set(customId, handler);
    }

    for (const [route, handler] of routed) {
        routes?.set(route, handler);
    }

    logger?.info(
        { event: `${folder}.loaded`, count: registry.size },
        `${title} discovery complete`,
    );
};
