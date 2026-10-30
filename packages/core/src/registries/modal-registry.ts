import { ModalBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { Modal } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";

export class ModalRegistry extends Collection<string, Modal> {
    constructor(private readonly logger?: Logger) {
        super();
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "modals",
            Modal,
            modal => {
                if (!(modal.builder instanceof ModalBuilder)) {
                    throw new TypeError(
                        "Modal handlers require a ModalBuilder.",
                    );
                }
            },
            this.logger,
        );
    }
}
