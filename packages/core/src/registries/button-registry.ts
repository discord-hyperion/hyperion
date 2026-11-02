import { CustomIdButtonBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { decodeParams } from "../components/custom-id-params.ts";
import { Button } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";

export class ButtonRegistry extends Collection<string, Button> {
    /** Params handlers by route; literal handlers stay keyed by exact custom ID. */
    readonly routes = new Collection<string, Button>();

    constructor(private readonly logger?: Logger) {
        super();
    }

    /** Exact custom ID first, then a params route; undefined when unmatched. */
    resolve(customId: string) {
        const exact = this.get(customId);
        if (exact) return { button: exact, raw: undefined };

        const button = this.routes.get(customId.split(":")[0] ?? "");
        if (!button?.params) return undefined;

        const raw = decodeParams(button.params, customId);

        return raw ? { button, raw } : undefined;
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
