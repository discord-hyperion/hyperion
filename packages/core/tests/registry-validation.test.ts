import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
    disableValidators,
    enableValidators,
    isValidationEnabled,
} from "@discordjs/builders";
import {
    ButtonRegistry,
    ModalRegistry,
    SelectMenuRegistry,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");
const discord = import.meta.resolve("discord.js");

for (const { folder, Handler, Registry, builder } of [
    {
        folder: "buttons",
        Handler: "Button",
        Registry: ButtonRegistry,
        builder: 'new PrimaryButtonBuilder().setCustomId("").setLabel("Test")',
    },
    {
        folder: "select-menus",
        Handler: "SelectMenu",
        Registry: SelectMenuRegistry,
        builder:
            'new StringSelectMenuBuilder().setCustomId("").addOptions({ label: "Test", value: "test" })',
    },
    {
        folder: "modals",
        Handler: "Modal",
        Registry: ModalRegistry,
        builder:
            'new ModalBuilder().setCustomId("").setTitle("Test").addLabelComponents(new LabelBuilder().setLabel("Input").setTextInputComponent(new TextInputBuilder().setCustomId("field").setStyle(TextInputStyle.Short)))',
    },
]) {
    test(`${folder} use native validation and respect explicit global opt-out`, async t => {
        const root = await createTempRoot(t, "hyperion-validation-");
        const directory = path.join(root, "src", folder);
        await mkdir(directory, { recursive: true });
        await writeFile(
            path.join(directory, "handler.mjs"),
            `
import { ${Handler} } from ${JSON.stringify(library)};
import { PrimaryButtonBuilder, StringSelectMenuBuilder, ModalBuilder, LabelBuilder, TextInputBuilder } from ${JSON.stringify(builders)};
import { TextInputStyle } from ${JSON.stringify(discord)};
export default class extends ${Handler} {
    constructor() { super({ builder: ${builder} }); }
    async run() {}
}`,
        );
        const enabled = isValidationEnabled();
        const registry = new Registry();

        try {
            enableValidators();
            await assert.rejects(registry.load(root), error => {
                assert.ok(error instanceof Error);
                assert.ok(error.cause instanceof Error);
                assert.match(error.message, /handler\.mjs/);
                return true;
            });
            assert.equal(registry.size, 0);

            disableValidators();
            await registry.load(root);
            assert.equal(registry.size, 1);
            assert.ok(registry.has(""));
        } finally {
            if (enabled) enableValidators();
            else disableValidators();
        }
    });
}
