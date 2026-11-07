import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { HyperionClient } from "@hyperion/core";
import { Events, REST } from "discord.js";

import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";

const createInteraction = (
    state: { deferred?: boolean; replied?: boolean } = {},
) =>
    createChatInputInteraction({
        id: "test-interaction",
        user: { id: "test-owner" },
        commandName: "ping",
        ...state,
    });

test("filesystem-loaded ping runs through the client's interaction listener", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-ping-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src", "commands"), { recursive: true });

    await writeFile(
        path.join(root, "src", "commands", "ping.mjs"),
        `export { default } from ${JSON.stringify(new URL("../src/commands/ping.ts", import.meta.url).href)};`,
    );

    const put = t.mock.method(REST.prototype, "put", async () => []);

    const client = await HyperionClient.create({
        name: "Test",
        logging: false as const,
        root,
        discord: { intents: [] },
        commands: {
            applicationId: "123",
            token: "test-token",
            guildIds: ["456"],
        },
    });

    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "test-owner");
    assert.equal(put.mock.callCount(), 1);
    assert.equal(client.listenerCount(Events.InteractionCreate), 1);

    const fixture = createInteraction();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Pong!");
    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(client.isReady(), false);
});
