import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ActionRowBuilder, StringSelectMenuBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

test("JSX string selects preserve builder identity, personalized defaults, and exact-ID/type dispatch", async t => {
    const root = await mkdtemp(
        path.join(
            fileURLToPath(new URL("../", import.meta.url)),
            ".consumer-select-",
        ),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, file, relative] of [
        ["commands", "show.tsx", "../src/commands/(components)/jsx-select.tsx"],
        [
            "select-menus",
            "priority.tsx",
            "../src/select-menus/jsx-priority.tsx",
        ],
    ] as const) {
        await mkdir(path.join(root, "src", folder), { recursive: true });
        await writeFile(
            path.join(root, "src", folder, file),
            `export { default } from ${JSON.stringify(new URL(relative, import.meta.url).href)};`,
        );
    }
    const client = await HyperionClient.create({
        root,
        name: "Test",
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    const handler = client.selectMenus.get("jsx.priority");
    assert.ok(handler?.builder instanceof StringSelectMenuBuilder);
    const template = handler.builder?.toJSON(false);
    const dispatcher = new InteractionDispatcher(client);

    for (const priority of ["low", "high"]) {
        const fixture = createChatInputInteraction({
            commandName: "jsx-select",
            options: { getString: () => priority, getBoolean: () => false },
        });
        await dispatcher.dispatch(fixture.interaction);
        const payload = fixture.reply.mock.calls[0]?.arguments[0];
        assert.ok(
            payload &&
                typeof payload === "object" &&
                "components" in payload &&
                Array.isArray(payload.components),
        );
        const row: unknown = payload.components[0];
        assert.ok(row instanceof ActionRowBuilder);
        const menu = row.components[0];
        assert.ok(menu instanceof StringSelectMenuBuilder);
        assert.notEqual(menu, handler.builder);
        assert.equal(menu.toJSON().disabled, false);
        assert.deepEqual(
            menu
                .toJSON()
                .options.filter(option => option.default)
                .map(option => option.value),
            [priority],
        );
    }
    assert.deepEqual(handler.builder?.toJSON(false), template);

    for (const values of [["high"], []]) {
        const fixture = createSelectInteraction(ComponentType.StringSelect, {
            customId: "jsx.priority",
            values,
        });
        await dispatcher.dispatch(fixture.interaction);
        assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
            content: `Selected priority: ${values.join(", ") || "None"}. This demo does not store selections.`,
            allowedMentions: { parse: [] },
        });
    }
    const unmatched = createSelectInteraction(ComponentType.StringSelect, {
        customId: "jsx.priority:other",
        values: ["high"],
    });
    const wrongType = createSelectInteraction(ComponentType.UserSelect, {
        customId: "jsx.priority",
        values: [],
    });
    await dispatcher.dispatch(unmatched.interaction);
    await dispatcher.dispatch(wrongType.interaction);
    assert.equal(unmatched.update.mock.callCount(), 0);
    assert.equal(unmatched.reply.mock.callCount(), 0);
    assert.equal(wrongType.update.mock.callCount(), 0);
    assert.deepEqual(handler.builder?.toJSON(false), template);
});
