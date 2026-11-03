import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ActionRowBuilder, CustomIdButtonBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import {
    createButtonInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";

test("JSX buttons preserve builder identity, personalized disabled state, and existing exact-ID routing", async t => {
    const root = await mkdtemp(
        path.join(
            fileURLToPath(new URL("../", import.meta.url)),
            ".consumer-buttons-",
        ),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, file, relative] of [
        [
            "commands",
            "show.tsx",
            "../src/commands/(components)/jsx-buttons.tsx",
        ],
        ["buttons", "refresh.tsx", "../src/buttons/jsx-refresh.tsx"],
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
    const dispatcher = new InteractionDispatcher(client);
    const handler = client.buttons.get("jsx.refresh");
    assert.ok(handler?.builder instanceof CustomIdButtonBuilder);
    const template = handler.builder?.toJSON(false);

    for (const disabled of [false, true]) {
        const fixture = createChatInputInteraction({
            commandName: "jsx-buttons",
            options: { getBoolean: () => disabled },
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
        const button = row.components[0];
        assert.ok(button instanceof CustomIdButtonBuilder);
        assert.equal(button.toJSON().disabled, disabled);
        assert.notEqual(button, handler.builder);
    }
    assert.deepEqual(handler.builder?.toJSON(false), template);
    const click = createButtonInteraction({ customId: "jsx.refresh" });
    await dispatcher.dispatch(click.interaction);
    assert.deepEqual(click.update.mock.calls[0]?.arguments[0], {
        content: "JSX button handled through the existing button registry.",
    });
    const unmatched = createButtonInteraction({
        customId: "jsx.refresh:other",
    });
    await dispatcher.dispatch(unmatched.interaction);
    assert.equal(unmatched.update.mock.callCount(), 0);
    assert.equal(unmatched.reply.mock.callCount(), 0);
});
