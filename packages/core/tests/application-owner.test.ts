import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { Client, ClientApplication, Events, Routes } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import { HyperionClient } from "../src/client/index.ts";
import { OwnerOnly } from "../src/guards/index.ts";

const applicationId = "100000000000000001";
const personalOwnerId = "200000000000000001";
const teamOwnerId = "200000000000000002";
const teamId = "300000000000000001";

const owner = (id: string) => ({
    id,
    username: "Owner",
    discriminator: "0",
    avatar: null,
});
const personalApplication = (id = personalOwnerId) => ({
    id: applicationId,
    name: "Test bot",
    owner: owner(id),
});

const setup = async (t: TestContext) => {
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());

    // Construct the same SDK application object populated by the gateway, without logging in.
    client.application = Reflect.construct(ClientApplication, [
        client,
        { id: applicationId },
    ]) as ClientApplication;

    return client;
};

const context = (client: HyperionClient, userId: string) => ({
    client,
    logger: client.logger,
    interaction: createChatInputInteraction({ user: { id: userId } })
        .interaction,
});

test("creating a client does not fetch ownership and pre-login lookup fails closed", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    const get = t.mock.method(client.rest, "get", async () =>
        personalApplication(),
    );

    await assert.rejects(
        new OwnerOnly().run(context(client, personalOwnerId)),
        /before the bot has logged in/,
    );
    assert.equal(get.mock.callCount(), 0);
});

test("OwnerOnly fetches the personal owner through Discord and caches the result", async t => {
    const client = await setup(t);
    const get = t.mock.method(client.rest, "get", async (route: string) => {
        assert.equal(route, Routes.currentApplication());
        return personalApplication();
    });
    const guard = new OwnerOnly();

    assert.equal(await guard.run(context(client, personalOwnerId)), true);
    assert.equal(await guard.run(context(client, "another-user")), false);
    assert.equal(await client.getOwnerId(), personalOwnerId);
    assert.equal(get.mock.callCount(), 1);
});

test("team-owned applications authorize only the team's owner", async t => {
    const client = await setup(t);
    t.mock.method(client.rest, "get", async () => ({
        ...personalApplication(),
        team: {
            id: teamId,
            name: "Developers",
            icon: null,
            owner_user_id: teamOwnerId,
            members: [],
        },
    }));
    const guard = new OwnerOnly();

    assert.equal(await client.getOwnerId(), teamOwnerId);
    assert.equal(await guard.run(context(client, teamOwnerId)), true);
    assert.equal(await guard.run(context(client, personalOwnerId)), false);
    assert.equal(await guard.run(context(client, teamId)), false);
});

test("concurrent owner checks share one API request", async t => {
    const client = await setup(t);
    let release = () => {};
    const wait = new Promise<void>(resolve => {
        release = resolve;
    });
    const get = t.mock.method(client.rest, "get", async () => {
        await wait;
        return personalApplication();
    });

    const first = client.getOwnerId();
    const second = new OwnerOnly().run(context(client, personalOwnerId));
    assert.equal(get.mock.callCount(), 1);

    release();
    assert.deepEqual(await Promise.all([first, second]), [
        personalOwnerId,
        true,
    ]);
    assert.equal(get.mock.callCount(), 1);
});

test("readiness prefetches the owner for later guard checks", async t => {
    const client = await setup(t);
    const get = t.mock.method(client.rest, "get", async () =>
        personalApplication(),
    );

    client.emit(Events.ClientReady, { user: { id: "bot" } } as Client<true>);
    await client.waitForAllListenersToComplete();
    assert.equal(get.mock.callCount(), 1);
    assert.equal(
        await new OwnerOnly().run(context(client, personalOwnerId)),
        true,
    );
    assert.equal(get.mock.callCount(), 1);
});

test("API failures are not authorized or permanently cached", async t => {
    const client = await setup(t);
    const failure = new Error("Discord unavailable");
    let attempts = 0;
    const get = t.mock.method(client.rest, "get", async () => {
        if (++attempts === 1) throw failure;
        return personalApplication();
    });
    const guard = new OwnerOnly();

    await assert.rejects(
        guard.run(context(client, personalOwnerId)),
        error => error === failure,
    );
    assert.equal(await guard.run(context(client, personalOwnerId)), true);
    assert.equal(get.mock.callCount(), 2);
});

test("missing ownership fails closed and readiness errors are logged and contained", async t => {
    const client = await setup(t);
    const get = t.mock.method(client.rest, "get", async () => ({
        id: applicationId,
        name: "No owner",
    }));
    const error = t.mock.method(client.logger, "error", () => undefined);

    client.emit(Events.ClientReady, { user: { id: "bot" } } as Client<true>);
    await client.waitForAllListenersToComplete();
    assert.equal(error.mock.callCount(), 1);

    await assert.rejects(
        new OwnerOnly().run(context(client, personalOwnerId)),
        /did not return an application owner/,
    );
    assert.equal(get.mock.callCount(), 2);
});

test("different bot clients resolve their own owners and a new login invalidates the cache", async t => {
    const first = await setup(t);
    const second = await setup(t);
    let currentOwner = personalOwnerId;
    const firstGet = t.mock.method(first.rest, "get", async () =>
        personalApplication(currentOwner),
    );
    const secondGet = t.mock.method(second.rest, "get", async () =>
        personalApplication(teamOwnerId),
    );
    t.mock.method(Client.prototype, "login", async () => "fake-login-result");

    assert.equal(await first.getOwnerId(), personalOwnerId);
    assert.equal(await second.getOwnerId(), teamOwnerId);

    currentOwner = teamOwnerId;
    await first.login("fake-token");
    assert.equal(await first.getOwnerId(), teamOwnerId);
    assert.equal(firstGet.mock.callCount(), 2);
    assert.equal(secondGet.mock.callCount(), 1);
});
