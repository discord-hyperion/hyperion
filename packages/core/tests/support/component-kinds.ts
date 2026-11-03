import { ComponentType } from "discord.js";
import type { HyperionClient } from "../../src/client/index.ts";
import {
    ButtonRegistry,
    ModalRegistry,
    SelectMenuRegistry,
} from "../../src/registries/index.ts";

const buildersModule = import.meta.resolve("@discordjs/builders");
const componentModule = (file: string) =>
    new URL(`../../src/components/${file}.ts`, import.meta.url).href;

const textModalBody =
    '.setTitle("Feedback").addLabelComponents(new LabelBuilder().setLabel("Message").setTextInputComponent(new TextInputBuilder().setCustomId("message").setStyle(1)))';

export type ComponentKind = {
    /** Noun used in framework error messages, e.g. "select menu". */
    noun: string;
    /** Folder under `<root>/src`, which is also the `client` property's source. */
    folder: string;
    property: keyof Pick<HyperionClient, "buttons" | "modals" | "selectMenus">;
    Registry: new () => ButtonRegistry | ModalRegistry | SelectMenuRegistry;
    /** Source of a valid handler module with the given custom ID. */
    source: (id: string, extra?: string) => string;
    /** Invalid modules that only make sense for this kind. */
    brokenModules: Record<string, string>;
};

export const buttonKind: ComponentKind = {
    noun: "button",
    folder: "buttons",
    property: "buttons",
    Registry: ButtonRegistry,
    source: (id, extra = "") => `
    import { ButtonHandler } from ${JSON.stringify(componentModule("button"))};
    import { PrimaryButtonBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends ButtonHandler {
        constructor() {
            super({ customId: ${JSON.stringify(id)}, builder: new PrimaryButtonBuilder()
                .setCustomId(${JSON.stringify(id)}).setLabel("Click"), ${extra} });
        }
        async run() {}
    }
`,
    get brokenModules() {
        return {
            "link button": buttonKind
                .source("link")
                .replaceAll("PrimaryButtonBuilder", "LinkButtonBuilder")
                .replace(
                    '.setCustomId("link")',
                    '.setURL("https://example.com")',
                ),
        };
    },
};

export const modalKind: ComponentKind = {
    noun: "modal",
    folder: "modals",
    property: "modals",
    Registry: ModalRegistry,
    source: (id, extra = "") => `
    import { ModalHandler } from ${JSON.stringify(componentModule("modal"))};
    import { ModalBuilder, LabelBuilder, TextInputBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends ModalHandler {
        constructor() {
            super({ customId: ${JSON.stringify(id)}, builder: new ModalBuilder()
                .setCustomId(${JSON.stringify(id)})${textModalBody}, ${extra} });
        }
        async run() {}
    }
`,
    get brokenModules() {
        return {
            "wrong builder": modalKind
                .source("wrong")
                .replaceAll("ModalBuilder", "PrimaryButtonBuilder")
                .replace(textModalBody, '.setLabel("Click")'),
            "missing title": modalKind
                .source("title")
                .replace('.setTitle("Feedback")', ""),
            "empty components": modalKind
                .source("empty")
                .replace(textModalBody, '.setTitle("Empty")'),
        };
    },
};

export const selectMenuKind: ComponentKind = {
    noun: "select menu",
    folder: "select-menus",
    property: "selectMenus",
    Registry: SelectMenuRegistry,
    source: (id, extra = "") => `
    import { SelectMenuHandler } from ${JSON.stringify(componentModule("select-menu"))};
    import { StringSelectMenuBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends SelectMenuHandler {
        constructor() {
            super({ customId: ${JSON.stringify(id)}, componentType: ${ComponentType.StringSelect}, builder: new StringSelectMenuBuilder()
                .setCustomId(${JSON.stringify(id)}).addOptions({ label: "Blue", value: "blue" }), ${extra} });
        }
        async run() {}
    }
`,
    get brokenModules() {
        return {
            "wrong component type": selectMenuKind
                .source("wrong")
                .replaceAll("StringSelectMenuBuilder", "ButtonBuilder")
                .replace(
                    '.setCustomId("wrong")',
                    '.setCustomId("wrong").setStyle(1)',
                )
                .replace('.addOptions({ label: "Blue", value: "blue" })', ""),
        };
    },
};

export const componentKinds: readonly ComponentKind[] = [
    buttonKind,
    modalKind,
    selectMenuKind,
];
