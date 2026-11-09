import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, type TestContext, test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { type PermissionResolvable, PermissionsBitField } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import purge from "../src/commands/(moderation)/purge.ts";

const setup = async (t: TestContext) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-purge-"));

    t.after(() => rm(root, { recursive: true, force: true }));

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    client.commands.set("purge", purge);

    return new InteractionDispatcher(client);
};

const purgeIn = (
    member: PermissionResolvable[],
    app: PermissionResolvable[],
) => {
    const fixture = createChatInputInteraction({
        commandName: "purge",
        guildId: "guild",
        member: { id: "member" },
        memberPermissions: new PermissionsBitField(member).freeze(),
        appPermissions: new PermissionsBitField(app).freeze(),
        options: { getInteger: () => 5 } as never,
    });
    const bulkDelete = mock.fn(async (count: number) =>
        Array.from({ length: count }, (_, index) => String(index)),
    );

    // The channel is local to this test: the shared fixtures have none.
    Object.assign(fixture.interaction, { channel: { bulkDelete } });

    return { ...fixture, bulkDelete };
};

const content = (call: { arguments: unknown[] } | undefined) => {
    const [response] = call?.arguments ?? [];

    return typeof response === "string"
        ? response
        : (response as { content?: string } | undefined)?.content;
};

test("purge deletes messages for a member who can manage them", async t => {
    const dispatcher = await setup(t);
    const allowed = purgeIn(
        ["ManageMessages"],
        ["ManageMessages", "ReadMessageHistory"],
    );

    await dispatcher.dispatch(allowed.interaction);

    assert.deepEqual(allowed.bulkDelete.mock.calls[0]?.arguments, [5, true]);
    assert.equal(
        content(allowed.editReply.mock.calls[0]),
        "Deleted 5 messages.",
    );
});

test("purge rejects members, or a bot, without the permissions", async t => {
    const dispatcher = await setup(t);
    const member = purgeIn([], ["ManageMessages", "ReadMessageHistory"]);
    const bot = purgeIn(["ManageMessages"], ["ManageMessages"]);

    await dispatcher.dispatch(member.interaction);
    await dispatcher.dispatch(bot.interaction);

    assert.equal(member.bulkDelete.mock.callCount(), 0);
    assert.equal(bot.bulkDelete.mock.callCount(), 0);
    assert.equal(
        content(member.reply.mock.calls[0]),
        "You need the Manage Messages permission to use this.",
    );
    assert.equal(
        content(bot.reply.mock.calls[0]),
        "I need the Manage Messages and Read Message History permissions here.",
    );
});
