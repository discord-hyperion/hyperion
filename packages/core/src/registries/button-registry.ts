import { CustomIdButtonBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { Button } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";
import { resolveRoute } from "./resolve-route.ts";

export class ButtonRegistry extends Collection<string, Button> {
    /** Params handlers by route; literal handlers stay keyed by exact custom ID. */
    readonly routes = new Collection<string, Button>();

    constructor(private readonly logger?: Logger) {
        super();
    }

    /** Exact custom ID first, then a params route; undefined when unmatched. */
    resolve(customId: string) {
        const match = resolveRoute(this, this.routes, customId);

        return match && { button: match.handler, raw: match.raw };
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
            this.routes,
        );
    }
}
