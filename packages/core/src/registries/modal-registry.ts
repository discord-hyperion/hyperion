import { ModalBuilder } from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import type {
    CustomIdParams,
    ParamValues,
} from "../components/custom-id-params.ts";
import { ModalHandler } from "../components/modal.ts";
import { buildTemplate } from "./build-template.ts";
import { loadComponentHandlers } from "./load-modules.ts";
import { resolveRoute } from "./resolve-route.ts";

export class ModalRegistry extends Collection<string, ModalHandler> {
    /** Params handlers by route; literal handlers stay keyed by exact custom ID. */
    readonly routes = new Collection<string, ModalHandler>();

    constructor(private readonly logger?: Logger) {
        super();
    }

    /** Exact custom ID first, then a params route; undefined when unmatched. */
    resolve(customId: string) {
        const match = resolveRoute(this, this.routes, customId, {
            logger: this.logger,
            kind: "modal",
        });

        return match && { modal: match.handler, raw: match.raw };
    }

    /** A fresh copy of a modal's form template with its custom ID set. */
    build(customId: string): ModalBuilder;
    build<Keys extends readonly string[]>(
        definition: CustomIdParams<Keys>,
        values: ParamValues<Keys>,
    ): ModalBuilder;
    build(
        target: string | CustomIdParams,
        values?: ParamValues<readonly string[]>,
    ) {
        return buildTemplate("modal", this, this.routes, target, values);
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers(
            this,
            root,
            "modals",
            ModalHandler,
            "defineModal",
            modal => {
                if (!(modal.builder instanceof ModalBuilder)) {
                    throw new TypeError(
                        "Modal templates must be ModalBuilder instances.",
                    );
                }
            },
            this.logger,
            this.routes,
        );
    }
}
