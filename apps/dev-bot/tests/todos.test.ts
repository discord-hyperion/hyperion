import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient } from "@hyperion/core";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import GetTodo from "../src/commands/(general)/[todo]/get.ts";
import { todos } from "../src/database.ts";

test("todo get replies with the stored todo, or says none matches", async t => {
    const client = await HyperionClient.create({
        name: "TodoTest",
        discord: { intents: [] },
        logging: { level: "silent", progress: false },
    });

    t.after(() => client.destroy());
    todos.set({
        id: "ab12",
        title: "Ship SQLite",
        description: null,
        deadline: "2026-11-30T00:00:00.000Z",
    });

    for (const [id, content] of [
        ["ab12", "Ship SQLite, due 2026-11-30T00:00:00.000Z"],
        ["zz99", "No todo has that ID."],
    ] as const) {
        const fixture = createChatInputInteraction({ deferred: true });

        await new GetTodo().run({
            client,
            logger: client.logger,
            interaction: fixture.interaction,
            input: [null, { todo: todos.get({ id }) }],
        });

        assert.deepEqual(fixture.editReply.mock.calls[0]?.arguments[0], {
            content,
            allowedMentions: { parse: [] },
        });
    }
});
