import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { EmbedBuilder } from "@discordjs/builders";
import { HyperionClient } from "@hyperion-js/core";
import { Events } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";

test("discovers the TSX demo and sends a native JSX embed through interaction dispatch", async t => {
    const root = await mkdtemp(
        path.join(
            fileURLToPath(new URL("../", import.meta.url)),
            ".consumer-jsx-",
        ),
    );

    t.after(() => rm(root, { recursive: true, force: true }));
    const jsx = path.join(root, "src", "commands", "[jsx]");
    await mkdir(jsx, { recursive: true });

    await writeFile(
        path.join(jsx, "index.ts"),
        `export { default } from ${JSON.stringify(new URL("../src/commands/[jsx]/index.ts", import.meta.url).href)};`,
    );

    await writeFile(
        path.join(jsx, "embed.tsx"),
        `export { default } from ${JSON.stringify(new URL("../src/commands/[jsx]/embed.tsx", import.meta.url).href)};`,
    );

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.commands.load(root);

    const fixture = createChatInputInteraction({
        id: "jsx-test",
        commandName: "jsx",
        options: {
            getSubcommand: () => "embed",
            getSubcommandGroup: () => null,
        },
        user: { id: "test-user" },
    });
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    const payload = fixture.reply.mock.calls[0]?.arguments[0];
    assert.ok(payload && typeof payload === "object" && "embeds" in payload);
    assert.ok(Array.isArray(payload.embeds));
    const embed: unknown = payload.embeds[0];
    assert.ok(embed instanceof EmbedBuilder);
    assert.equal(embed.toJSON().title, "Todo preview");
    assert.match(embed.toJSON().description ?? "", /\*\*Review JSX embeds\*\*/);
});
