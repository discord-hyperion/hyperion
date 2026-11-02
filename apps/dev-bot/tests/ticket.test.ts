import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { MessageFlags } from "discord.js";
import {
    createButtonInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";

const setup = async (t: TestContext) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-ticket-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, modulePath] of [
        ["commands", "commands/(general)/ticket"],
        ["buttons", "buttons/close-ticket"],
    ] as const) {
        const directory = path.join(root, "src", folder);
        await mkdir(directory, { recursive: true });
        const url = new URL(`../src/${modulePath}.ts`, import.meta.url);
        await writeFile(
            path.join(directory, "handler.mjs"),
            `export { default } from ${JSON.stringify(url.href)};`,
        );
    }

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(root);
    await client.buttons.load(root);

    return { client, dispatcher: new InteractionDispatcher(client) };
};

const openTicket = async (dispatcher: InteractionDispatcher) => {
    const { interaction, reply } = createChatInputInteraction({
        id: "open",
        commandName: "ticket",
        user: { id: "author" },
        options: { getString: () => "Printer on fire" },
    });
    await dispatcher.dispatch(interaction);

    const payload = reply.mock.calls[0]?.arguments[0] as {
        content: string;
        components: { toJSON(): { components: { custom_id: string }[] } }[];
    };

    return {
        content: payload.content,
        customId: payload.components[0]?.toJSON().components[0]?.custom_id,
    };
};

const click = (customId: string, userId: string) =>
    createButtonInteraction({
        id: `click-${userId}`,
        customId,
        user: { id: userId },
    });

test("development ticket command sends a Close button that only its author can use", async t => {
    const { dispatcher } = await setup(t);
    const { content, customId } = await openTicket(dispatcher);
    const ticketId = /^Ticket ([0-9a-f]{8}):/.exec(content)?.[1];

    assert.ok(ticketId);
    assert.equal(customId, `ticket.close:${ticketId}:author`);

    const intruder = click(customId, "intruder");
    await dispatcher.dispatch(intruder.interaction);

    assert.equal(intruder.update.mock.callCount(), 0);
    assert.deepEqual(intruder.reply.mock.calls[0]?.arguments[0], {
        content: "Only the ticket's author can close it.",
        flags: MessageFlags.Ephemeral,
    });

    const author = click(customId, "author");
    await dispatcher.dispatch(author.interaction);

    assert.deepEqual(author.update.mock.calls[0]?.arguments[0], {
        content: `Ticket ${ticketId} closed.`,
        components: [],
    });
});

test("development ticket button rejects forged IDs and ignores malformed ones", async t => {
    const { dispatcher } = await setup(t);

    // Schema failure: guards still run, and the ownership guard rejects.
    const forged = click("ticket.close:not-a-ticket:author", "author");
    await dispatcher.dispatch(forged.interaction);

    assert.equal(forged.update.mock.callCount(), 0);
    assert.equal(forged.reply.mock.callCount(), 1);

    // Wrong segment count: unmatched, so application listeners can handle it.
    const malformed = click("ticket.close:abcd1234", "author");
    await dispatcher.dispatch(malformed.interaction);

    assert.equal(malformed.reply.mock.callCount(), 0);
    assert.equal(malformed.update.mock.callCount(), 0);
});
