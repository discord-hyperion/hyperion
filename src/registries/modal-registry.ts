import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ModalBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { Modal } from "../components/index.ts";
import { assertRegistryClass, discoverModules } from "../util/index.ts";

export class ModalRegistry extends Collection<string, Modal> {
    constructor(private readonly logger?: Logger) {
        super();
    }

    async load(root: string | URL = process.cwd()) {
        const rootPath =
            root instanceof URL ? fileURLToPath(root) : path.resolve(root);
        const directory = path.join(rootPath, "src", "modals");

        this.logger?.debug(
            { event: "modals.discover", directory },
            "Discovering modal files",
        );

        const files = await discoverModules(directory, () => {
            this.logger?.debug(
                { event: "modals.directory.missing", directory },
                "Optional modal directory does not exist",
            );
        });

        const modals = new Collection<string, Modal>();

        for (const file of files) {
            let modal: Modal;

            try {
                const module = await import(pathToFileURL(file).href);
                const ModalClass = module.default;

                assertRegistryClass(ModalClass, Modal);

                modal = new ModalClass();

                if (typeof modal.run !== "function") {
                    throw new TypeError(
                        "Modal handlers must provide a run() method.",
                    );
                }

                if (!(modal.builder instanceof ModalBuilder)) {
                    throw new TypeError(
                        "Modal handlers require a ModalBuilder.",
                    );
                }

                const data = modal.builder.toJSON();

                if (typeof data.custom_id !== "string" || !data.custom_id) {
                    throw new TypeError(
                        "Modal handlers require a custom-ID builder.",
                    );
                }

                if (data.custom_id !== modal.customId) {
                    throw new Error(
                        "Modal builder custom ID must match its handler's custom ID.",
                    );
                }
            } catch (cause) {
                throw new Error(`Failed to load modal from "${file}".`, {
                    cause,
                });
            }

            if (modals.has(modal.customId)) {
                throw new Error(
                    `Duplicate modal custom ID "${modal.customId}" in "${file}".`,
                );
            }

            modals.set(modal.customId, modal);

            this.logger?.debug(
                {
                    event: "modal.loaded",
                    modal: modal.customId,
                    source: file,
                },
                "Loaded modal",
            );
        }

        this.clear();

        for (const [customId, modal] of modals) {
            this.set(customId, modal);
        }

        this.logger?.info(
            { event: "modals.loaded", count: this.size },
            "Modal discovery complete",
        );
    }
}
