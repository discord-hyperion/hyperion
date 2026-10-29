import assert from "node:assert/strict";
import { test } from "node:test";
import CreateTodo from "../dev/bot/src/commands/(general)/[todo]/create.ts";
import GetTodo from "../dev/bot/src/commands/(general)/[todo]/get.ts";
import { HyperionClient } from "../src/index.ts";
import { createChatInputInteraction } from "./fixtures/interactions.ts";

for (const Handler of [CreateTodo, GetTodo]) {
    test(`${Handler.name || "todo handler"} displays issue messages instead of object coercions`, async t => {
        const client = await HyperionClient.create({
            name: "TodoTest",
            discord: { intents: [] },
            logging: { level: "silent", progress: false },
        });
        t.after(() => client.destroy());
        const fixture = createChatInputInteraction({ deferred: true });
        const issues = [
            { message: "Name is required", path: ["name"] },
            { message: "Deadline must be a timestamp", path: ["deadline"] },
        ];
        await new Handler().run({
            client,
            logger: client.logger,
            interaction: fixture.interaction,
            input: [issues, undefined],
        });
        assert.equal(fixture.editReply.mock.callCount(), 1);
        assert.deepEqual(fixture.editReply.mock.calls[0]?.arguments[0], {
            content: "Name is required\nDeadline must be a timestamp",
        });
    });
}
