import { CustomIdButtonBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { ButtonHandler } from "../components/button.ts";
import type {
    CustomIdParams,
    ParamValues,
} from "../components/custom-id-params.ts";
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
        const match = resolveRoute(this, this.routes, customId, {
            logger: this.logger,
            kind: "button",
        });

        return match && { button: match.handler, raw: match.raw };
    }

    /** A fresh copy of a handler's template with its custom ID set. */
    build(customId: string): CustomIdButtonBuilder;
    build<Keys extends readonly string[]>(
        definition: CustomIdParams<Keys>,
        values: ParamValues<Keys>,
    ): CustomIdButtonBuilder;
    build(
        target: string | CustomIdParams,
        values?: ParamValues<readonly string[]>,
    ) {
        return buildTemplate("button", this, this.routes, target, values);
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "buttons",
            ButtonHandler,
            "defineButton",
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
