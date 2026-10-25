import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection, ComponentType } from "discord.js";
import type { Logger } from "pino";
import { SelectMenu } from "../components/index.ts";
import { discoverModules } from "../util/index.ts";

export class SelectMenuRegistry extends Collection<string, SelectMenu> {
    public constructor(private readonly logger?: Logger) {
        super();
    }

    public async load(root: string | URL = process.cwd()) {
        const rootPath =
            root instanceof URL ? fileURLToPath(root) : path.resolve(root);
        const directory = path.join(rootPath, "src", "select-menus");

        this.logger?.debug(
            { event: "select-menus.discover", directory },
            "Discovering select menu files",
        );

        const files = await discoverModules(directory, () => {
            this.logger?.debug(
                { event: "select-menus.directory.missing", directory },
                "Optional select menu directory does not exist",
            );
        });

        const selectMenus = new Collection<string, SelectMenu>();

        for (const file of files) {
            let selectMenu: SelectMenu;

            try {
                const module = await import(pathToFileURL(file).href);
                const SelectMenuClass = module.default;

                if (
                    typeof SelectMenuClass !== "function" ||
                    !(SelectMenuClass.prototype instanceof SelectMenu)
                ) {
                    throw new TypeError(
                        "Expected a default-exported class extending SelectMenu.",
                    );
                }

                selectMenu = new SelectMenuClass();

                if (typeof selectMenu.run !== "function") {
                    throw new TypeError(
                        "SelectMenu handlers must provide a run() method.",
                    );
                }

                // Validate the complete builder locally; select menus have no deployment request.
                const data = selectMenu.builder.toJSON();

                if (data.type !== ComponentType.StringSelect) {
                    throw new TypeError(
                        "SelectMenu requires a string select builder.",
                    );
                }

                if (typeof data.custom_id !== "string" || !data.custom_id) {
                    throw new TypeError(
                        "SelectMenu handlers require an interactive custom-ID builder.",
                    );
                }

                if (data.custom_id !== selectMenu.customId) {
                    throw new Error(
                        "SelectMenu builder custom ID must match its handler's custom ID.",
                    );
                }
            } catch (cause) {
                throw new Error(`Failed to load select menu from "${file}".`, {
                    cause,
                });
            }

            if (selectMenus.has(selectMenu.customId)) {
                throw new Error(
                    `Duplicate select menu custom ID "${selectMenu.customId}" in "${file}".`,
                );
            }

            selectMenus.set(selectMenu.customId, selectMenu);

            this.logger?.debug(
                {
                    event: "select-menu.loaded",
                    selectMenu: selectMenu.customId,
                    source: file,
                },
                "Loaded select menu",
            );
        }

        this.clear();

        for (const [customId, selectMenu] of selectMenus) {
            this.set(customId, selectMenu);
        }

        this.logger?.info(
            { event: "select-menus.loaded", count: this.size },
            "Select menu discovery complete",
        );
    }
}
