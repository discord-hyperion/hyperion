import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { Collection, type ComponentType } from "discord.js";
import type { Logger } from "pino";
import { type AnySelectMenu, SelectMenu } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";
import { resolveRoute } from "./resolve-route.ts";

export class SelectMenuRegistry extends Collection<string, AnySelectMenu> {
    /** Params handlers by route, shared by every select type. */
    readonly routes = new Collection<string, AnySelectMenu>();

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

    async load(root: string | URL = process.cwd()) {
        await loadComponentHandlers<AnySelectMenu>(
            this,
            root,
            "select-menus",
            SelectMenu,
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
                        "SelectMenu requires a string, user, role, mentionable, or channel select builder.",
                    );
                }

                if (data.type !== selectMenu.componentType) {
                    throw new Error(
                        "SelectMenu builder type must match its handler's component type.",
                    );
                }
            },
            this.logger,
            this.routes,
        );
    }
}
