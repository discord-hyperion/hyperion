import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { Button } from "../components/index.ts";
import { assertRegistryClass, discoverModules } from "../util/index.ts";

export class ButtonRegistry extends Collection<string, Button> {
    public constructor(private readonly logger?: Logger) {
        super();
    }

    public async load(root: string | URL = process.cwd()) {
        const rootPath =
            root instanceof URL ? fileURLToPath(root) : path.resolve(root);
        const directory = path.join(rootPath, "src", "buttons");

        this.logger?.debug(
            { event: "buttons.discover", directory },
            "Discovering button files",
        );

        const files = await discoverModules(directory, () => {
            this.logger?.debug(
                { event: "buttons.directory.missing", directory },
                "Optional button directory does not exist",
            );
        });

        const buttons = new Collection<string, Button>();

        for (const file of files) {
            let button: Button;

            try {
                const module = await import(pathToFileURL(file).href);
                const ButtonClass = module.default;

                assertRegistryClass(ButtonClass, Button);

                button = new ButtonClass();

                if (typeof button.run !== "function") {
                    throw new TypeError(
                        "Button handlers must provide a run() method.",
                    );
                }

                // Validate the complete builder locally; buttons have no deployment request.
                const data = button.builder.toJSON();

                if (typeof data.custom_id !== "string" || !data.custom_id) {
                    throw new TypeError(
                        "Button handlers require an interactive custom-ID builder.",
                    );
                }

                if (data.custom_id !== button.customId) {
                    throw new Error(
                        "Button builder custom ID must match its handler's custom ID.",
                    );
                }
            } catch (cause) {
                throw new Error(`Failed to load button from "${file}".`, {
                    cause,
                });
            }

            if (buttons.has(button.customId)) {
                throw new Error(
                    `Duplicate button custom ID "${button.customId}" in "${file}".`,
                );
            }

            buttons.set(button.customId, button);

            this.logger?.debug(
                {
                    event: "button.loaded",
                    button: button.customId,
                    source: file,
                },
                "Loaded button",
            );
        }

        this.clear();

        for (const [customId, button] of buttons) {
            this.set(customId, button);
        }

        this.logger?.info(
            { event: "buttons.loaded", count: this.size },
            "Button discovery complete",
        );
    }
}
