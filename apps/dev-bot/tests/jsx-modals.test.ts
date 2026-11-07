import assert from "node:assert/strict";
import { test } from "node:test";
import { ModalBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createModalInteraction,
} from "../../../tests/fixtures/interactions.ts";

test("JSX modal discovery, fresh opening and exact-ID submission preserve the shared definition", async t => {
    const root = new URL("../", import.meta.url);
    const records: string[] = [];

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: {
            pretty: false,
            destination: { write: line => records.push(line) },
        },
    });

    t.after(() => client.destroy());
    await client.commands.load(root);

    const handler = client.modals.get("todo.create");
    const dispatcher = new InteractionDispatcher(client);
    assert.ok(handler);
    const template = handler.builder?.toJSON(false);
    const opened: ModalBuilder[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
        const fixture = createChatInputInteraction({
            commandName: "jsx",
            options: {
                getSubcommand: () => "modal",
                getSubcommandGroup: () => null,
            },
            user: { id: "test-user" },
        });
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.equal(fixture.deferReply.mock.callCount(), 0);
        assert.equal(fixture.showModal.mock.callCount(), 1);
        const builder = fixture.showModal.mock.calls[0]?.arguments[0];
        assert.ok(builder instanceof ModalBuilder);
        assert.notEqual(builder, handler.builder);
        assert.equal(builder.toJSON().custom_id, handler.customId);
        opened.push(builder);
    }

    assert.notEqual(opened[0], opened[1]);
    assert.deepEqual(handler.builder?.toJSON(false), template);

    const submitted = createModalInteraction({
        customId: "todo.create",
        components: {
            data: [
                {
                    id: 1,
                    type: ComponentType.Label,
                    component: {
                        id: 2,
                        type: ComponentType.TextInput,
                        customId: "name",
                        value: "Private submitted name",
                    },
                },
                {
                    id: 3,
                    type: ComponentType.Label,
                    component: {
                        id: 4,
                        type: ComponentType.TextInput,
                        customId: "description",
                        value: "Private description",
                    },
                },
            ],
        },
        user: { id: "test-user" },
    });
    await dispatcher.dispatch(submitted.interaction);

    assert.equal(submitted.reply.mock.callCount(), 0);
    assert.equal(submitted.deferReply.mock.callCount(), 1);
    assert.deepEqual(submitted.editReply.mock.calls[0]?.arguments[0], {
        content:
            "Received a todo name of 22 characters and description of 19 characters. This demo does not store submissions.",
        allowedMentions: { parse: [] },
    });
    assert.deepEqual(handler.builder?.toJSON(false), template);
    assert.ok(
        records.every(
            line =>
                !line.includes("Private submitted name") &&
                !line.includes("Private description"),
        ),
    );
});
