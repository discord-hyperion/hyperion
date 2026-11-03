import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";
import type { ModalBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { Collection, ComponentType, MessageFlags } from "discord.js";
import {
    createButtonInteraction,
    createChatInputInteraction,
    createModalInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const setup = async (t: TestContext) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-ticket-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, modulePath] of [
        ["commands", "commands/(general)/ticket"],
        ["buttons", "buttons/close-ticket"],
        ["buttons", "buttons/rename-ticket"],
        ["select-menus", "select-menus/assign-ticket"],
        ["modals", "modals/rename-ticket"],
    ] as const) {
        const directory = path.join(root, "src", folder);
        await mkdir(directory, { recursive: true });
        const url = new URL(`../src/${modulePath}.ts`, import.meta.url);
        await writeFile(
            path.join(directory, `${path.basename(modulePath)}.mjs`),
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
    await client.selectMenus.load(root);
    await client.modals.load(root);

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

    const [assignRow, closeRow] = payload.components;

    return {
        content: payload.content,
        assignId: assignRow?.toJSON().components[0]?.custom_id,
        customId: closeRow?.toJSON().components[0]?.custom_id,
        renameId: closeRow?.toJSON().components[1]?.custom_id,
    };
};

const assign = (customId: string, userId: string) =>
    createSelectInteraction(ComponentType.UserSelect, {
        id: `assign-${userId}`,
        customId,
        values: ["helper"],
        users: new Collection([
            ["helper", { id: "helper", username: "Helper" }],
        ]),
        members: new Collection(),
        user: { id: userId },
    });

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

test("development ticket command sends an Assign menu that carries the ticket separately from the selection", async t => {
    const { dispatcher } = await setup(t);
    const { content, assignId } = await openTicket(dispatcher);
    const ticketId = /^Ticket ([0-9a-f]{8}):/.exec(content)?.[1];

    assert.ok(ticketId && assignId);
    assert.equal(assignId, `ticket.assign:${ticketId}:author`);

    const intruder = assign(assignId, "intruder");
    await dispatcher.dispatch(intruder.interaction);

    assert.equal(intruder.update.mock.callCount(), 0);
    assert.deepEqual(intruder.reply.mock.calls[0]?.arguments[0], {
        content: "Only the ticket's author can assign it.",
        flags: MessageFlags.Ephemeral,
    });

    const author = assign(assignId, "author");
    await dispatcher.dispatch(author.interaction);

    assert.deepEqual(author.update.mock.calls[0]?.arguments[0], {
        content: `Ticket ${ticketId} assigned to Helper.`,
        allowedMentions: { parse: [] },
    });

    // The same custom ID on a button is a different registry: unmatched.
    const crossed = click(assignId, "author");
    await dispatcher.dispatch(crossed.interaction);

    assert.equal(crossed.reply.mock.callCount(), 0);
    assert.equal(crossed.update.mock.callCount(), 0);
});

const submitRename = (customId: string, userId: string, title: string) =>
    createModalInteraction({
        id: `rename-${userId}`,
        customId,
        user: { id: userId },
        message: { id: "ticket-message" },
        components: {
            data: [
                {
                    id: 1,
                    type: ComponentType.Label,
                    component: {
                        id: 2,
                        type: ComponentType.TextInput,
                        customId: "title",
                        value: title,
                    },
                },
            ],
        },
    });

test("development ticket Rename opens a modal that carries the ticket and checks ownership again", async t => {
    const { dispatcher } = await setup(t);
    const { content, renameId } = await openTicket(dispatcher);
    const ticketId = /^Ticket ([0-9a-f]{8}):/.exec(content)?.[1];

    assert.ok(ticketId && renameId);
    assert.equal(renameId, `ticket.rename:${ticketId}:author`);

    const intruderClick = click(renameId, "intruder");
    await dispatcher.dispatch(intruderClick.interaction);

    assert.equal(intruderClick.showModal.mock.callCount(), 0);

    const authorClick = click(renameId, "author");
    await dispatcher.dispatch(authorClick.interaction);

    const form = authorClick.showModal.mock.calls[0]?.arguments[0] as
        | ModalBuilder
        | undefined;
    const formId = form?.toJSON().custom_id;

    assert.equal(formId, `ticket.rename-form:${ticketId}:author`);
    assert.ok(formId);

    // A forged submission reaches the modal handler, whose guard rejects it.
    const intruderSubmit = submitRename(formId, "intruder", "Hijacked");
    await dispatcher.dispatch(intruderSubmit.interaction);

    assert.equal(intruderSubmit.update.mock.callCount(), 0);
    assert.deepEqual(intruderSubmit.reply.mock.calls[0]?.arguments[0], {
        content: "Only the ticket's author can rename it.",
        flags: MessageFlags.Ephemeral,
    });

    const blank = submitRename(formId, "author", "   ");
    await dispatcher.dispatch(blank.interaction);

    assert.equal(blank.update.mock.callCount(), 0);
    assert.deepEqual(blank.reply.mock.calls[0]?.arguments[0], {
        content: "The title must not be blank.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });

    const renamed = submitRename(formId, "author", "  Printer fixed  ");
    await dispatcher.dispatch(renamed.interaction);

    assert.deepEqual(renamed.update.mock.calls[0]?.arguments[0], {
        content: `Ticket ${ticketId}: Printer fixed`,
        allowedMentions: { parse: [] },
    });
});
