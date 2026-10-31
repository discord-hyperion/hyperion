import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { ModalBuilder } from "@discordjs/builders";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import {
    createChatInputInteraction,
    createModalInteraction,
} from "../../../tests/fixtures/interactions.ts";

test("JSX modal discovery, personalized opening and exact-ID submission preserve the shared definition", async t => {
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
    const template = handler.builder.toJSON();
    const opened: ModalBuilder[] = [];

    for (const name of [
        "First private initial value",
        "Second private initial value",
    ]) {
        const fixture = createChatInputInteraction({
            commandName: "jsx-modal",
            user: { id: "test-user" },
            options: { getString: () => name },
        });
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.equal(fixture.deferReply.mock.callCount(), 0);
        assert.equal(fixture.showModal.mock.callCount(), 1);
        const builder = fixture.showModal.mock.calls[0]?.arguments[0];
        assert.ok(builder instanceof ModalBuilder);
        assert.notEqual(builder, handler.builder);
        assert.equal(builder.toJSON().custom_id, handler.customId);
        assert.ok(JSON.stringify(builder.toJSON()).includes(name));
        opened.push(builder);
    }

    assert.notEqual(opened[0], opened[1]);
    assert.ok(
        !JSON.stringify(opened[0]?.toJSON()).includes(
            "Second private initial value",
        ),
    );
    assert.deepEqual(handler.builder.toJSON(), template);

    const getTextInputValue = mock.fn((id: string) =>
        id === "name" ? "Private submitted name" : "Private description",
    );
    const submitted = createModalInteraction({
        customId: "todo.create",
        components: { getTextInputValue },
        user: { id: "test-user" },
    });
    await dispatcher.dispatch(submitted.interaction);

    assert.deepEqual(
        getTextInputValue.mock.calls.map(call => call.arguments[0]),
        ["name", "description"],
    );
    assert.equal(submitted.reply.mock.callCount(), 1);
    assert.deepEqual(handler.builder.toJSON(), template);
    assert.ok(
        records.every(
            line =>
                !line.includes("Private submitted name") &&
                !line.includes("Private description") &&
                !line.includes("private initial value"),
        ),
    );
});
