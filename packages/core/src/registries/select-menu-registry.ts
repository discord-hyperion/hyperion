import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { Collection, type ComponentType } from "discord.js";
import type { Logger } from "pino";
import {
    type AnySelectMenuHandler,
    SelectMenuHandler,
} from "../components/index.ts";
import { buildTemplate } from "./build-template.ts";
import { loadComponentHandlers } from "./load-modules.ts";
import { resolveRoute } from "./resolve-route.ts";

export class SelectMenuRegistry extends Collection<
    string,
    AnySelectMenuHandler
> {
    /** Params handlers by route, shared by every select type. */
    readonly routes = new Collection<string, AnySelectMenuHandler>();

    constructor(private readonly logger?: Logger) {
        super();
    }

    /**
     * Exact custom ID first, then a params route. A handler of another select
     * type is unmatched, and is rejected before its params are decoded.
     */
    resolve(customId: string, componentType: ComponentType) {
        const match = resolveRoute(
            this,
            this.routes,
            customId,
            selectMenu => selectMenu.componentType === componentType,
        );

        return match && { selectMenu: match.handler, raw: match.raw };
    }

    /** A fresh copy of template with its custom ID set. */
    build(customId: string) {
        return buildTemplate("select menu", this, this.routes, customId);
    }

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers<AnySelectMenuHandler>(
            this,
            root,
            "select-menus",
            SelectMenuHandler,
            (selectMenu, data) => {
                if (
                    ![
                        StringSelectMenuBuilder,
                        UserSelectMenuBuilder,
                        RoleSelectMenuBuilder,
                        MentionableSelectMenuBuilder,
                        ChannelSelectMenuBuilder,
                    ].some(builder => selectMenu.builder instanceof builder)
                ) {
                    throw new TypeError(
                        "Select menu templates must be string, user, role, mentionable, or channel select builders.",
                    );
                }

                if (data.type !== selectMenu.componentType) {
                    throw new Error(
                        "Select menu template type must match its handler's component type.",
                    );
                }
            },
            this.logger,
            this.routes,
        );
    }
}
