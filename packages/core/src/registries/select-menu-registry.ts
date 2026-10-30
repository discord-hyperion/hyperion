import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { Collection } from "discord.js";
import type { Logger } from "pino";
import { type AnySelectMenu, SelectMenu } from "../components/index.ts";
import { loadComponentHandlers } from "./load-modules.ts";

export class SelectMenuRegistry extends Collection<string, AnySelectMenu> {
    constructor(private readonly logger?: Logger) {
        super();
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
        );
    }
}
