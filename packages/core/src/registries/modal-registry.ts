import { ModalBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { ModalHandler } from "../components/index.ts";
import { buildTemplate } from "./build-template.ts";
import { loadComponentHandlers } from "./load-modules.ts";

export class ModalRegistry extends Collection<string, ModalHandler> {
    constructor(private readonly logger?: Logger) {
        super();
    }

    /** A fresh copy of a modal's form template with its custom ID set. */
    build(customId: string) {
        return buildTemplate("modal", this, undefined, customId);
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "modals",
            ModalHandler,
            modal => {
                if (!(modal.builder instanceof ModalBuilder)) {
                    throw new TypeError(
                        "Modal templates must be ModalBuilder instances.",
                    );
                }
            },
            this.logger,
        );
    }
}
