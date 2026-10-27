import { CustomIdButtonBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { Button } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";

export class ButtonRegistry extends Collection<string, Button> {
    constructor(private readonly logger?: Logger) {
        super();
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "buttons",
            Button,
            button => {
                if (!(button.builder instanceof CustomIdButtonBuilder)) {
                    throw new TypeError(
                        "Button handlers require an interactive custom-ID builder.",
                    );
                }
            },
            this.logger,
        );
    }
}
