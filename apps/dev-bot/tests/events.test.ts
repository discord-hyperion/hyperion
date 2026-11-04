import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient } from "@hyperion/core";
import { ClientUser, Events } from "discord.js";

test("filesystem ready handlers execute in order once, alongside internal readiness", async t => {
    const records: { msg: string; source?: string }[] = [];

    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../", import.meta.url),
        discord: { intents: [] },
        logging: {
            pretty: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });

    t.after(() => client.destroy());
    client.user = Reflect.construct(ClientUser, [
        client,
        { id: "123", username: "Test", discriminator: "0", avatar: null },
    ]);
    const owner = t.mock.method(client, "getOwnerId", async () => "owner");
    Reflect.apply(client.emit, client, [Events.ClientReady, client]);
    await client.waitForAllListenersToComplete();
    const startup = records.filter(record =>
        record.source?.startsWith("clientReady/"),
    );
    assert.deepEqual(
        startup.map(record => record.msg),
        ["Development bot startup event", "Development bot startup details"],
    );
    assert.equal(owner.mock.callCount(), 1);
    assert.ok(records.some(record => record.msg === "Discord client ready"));
    Reflect.apply(client.emit, client, [Events.ClientReady, client]);
    await client.waitForAllListenersToComplete();
    assert.equal(
        records.filter(record => record.source?.startsWith("clientReady/"))
            .length,
        2,
    );
});
