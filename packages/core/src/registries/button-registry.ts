import { CustomIdButtonBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { ButtonHandler } from "../components/index.ts";
import { buildTemplate } from "./build-template.ts";
import { loadComponentHandlers } from "./load-modules.ts";
import { resolveRoute } from "./resolve-route.ts";

export class ButtonRegistry extends Collection<string, ButtonHandler> {
    /** Params handlers by route; literal handlers stay keyed by exact custom ID. */
    readonly routes = new Collection<string, ButtonHandler>();

    constructor(private readonly logger?: Logger) {
        super();
    }

    /** Exact custom ID first, then a params route; undefined when unmatched. */
    resolve(customId: string) {
        const match = resolveRoute(this, this.routes, customId);

        return match && { button: match.handler, raw: match.raw };
    }

    /** A fresh copy of a literal handler's template with its custom ID set. */
    build(customId: string) {
        return buildTemplate("button", this, this.routes, customId);
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "buttons",
            ButtonHandler,
            button => {
                if (!(button.builder instanceof CustomIdButtonBuilder)) {
                    throw new TypeError(
                        "Button templates must be interactive custom-ID builders.",
                    );
                }
            },
            this.logger,
            this.routes,
        );
    }
}
