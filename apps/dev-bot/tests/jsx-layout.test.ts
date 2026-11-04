import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ContainerBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";

test("JSX layout command replies with a private layout message", async t => {
    const root = await mkdtemp(
        path.join(
            fileURLToPath(new URL("../", import.meta.url)),
            ".consumer-layout-",
        ),
    );

    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src", "commands"), { recursive: true });

    await writeFile(
        path.join(root, "src", "commands", "layout.tsx"),
        `export { default } from ${JSON.stringify(new URL("../src/commands/(components)/jsx-layout.tsx", import.meta.url).href)};`,
    );

    const client = await HyperionClient.create({
        root,
        name: "Test",
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.commands.load(root);

    const avatar = "https://cdn.example.com/avatar.png";
    const fixture = createChatInputInteraction({
        commandName: "jsx-layout",
        user: {
            id: "caller",
            username: "Caller",
            displayAvatarURL: () => avatar,
        },
    });
    await new InteractionDispatcher(client).dispatch(fixture.interaction);

    const payload = fixture.reply.mock.calls[0]?.arguments[0] as {
        flags: readonly string[];
        components: ContainerBuilder[];
        content?: string;
    };
    assert.deepEqual(payload.flags, ["IsComponentsV2", "Ephemeral"]);
    assert.equal(payload.content, undefined);
    assert.equal(payload.components.length, 1);
    assert.ok(payload.components[0] instanceof ContainerBuilder);

    const json = JSON.stringify(payload.components[0]?.toJSON());
    assert.match(json, /## Hello, Caller/);
    assert.match(json, /avatar\.png/);
});
