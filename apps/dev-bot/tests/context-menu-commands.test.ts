import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ApplicationCommandType, MessageFlags } from "discord.js";
import {
    createMessageContextInteraction,
    createUserContextInteraction,
} from "../../../tests/fixtures/interactions.ts";

type ContextType = ApplicationCommandType.User | ApplicationCommandType.Message;
const interaction = (type: ContextType, phase = "new", caller = "caller") => {
    const data = {
        id: "context-command",
        commandName: "Inspect",
        guildId: "guild",
        user: { id: caller },
        deferred: phase === "deferred",
        replied: phase === "replied",
        ephemeral: phase === "deferred" ? false : null,
    };
    return type === ApplicationCommandType.User
        ? createUserContextInteraction({
              ...data,
              targetUser: {
                  id: "selected-user",
                  username: "Private target user",
              },
              targetMember: null,
          })
        : createMessageContextInteraction({
              ...data,
              targetMessage: {
                  id: "selected-message",
                  content: "Private target content",
                  author: { username: "Private target author" },
              },
          });
};

const setup = async (t: TestContext) => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level: "debug",
            pretty: false,
            progress: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });
    t.after(() => client.destroy());
    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

for (const type of [
    ApplicationCommandType.User,
    ApplicationCommandType.Message,
] as const) {
    test(`development context command type ${type} runs its filesystem example`, async t => {
        const { client, dispatcher } = await setup(t);
        t.mock.method(client, "getOwnerId", async () => "owner");
        await client.commands.load(new URL("../", import.meta.url));
        const fixture = interaction(type, "new", "owner");
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(fixture.reply.mock.callCount(), 1);
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content:
                type === ApplicationCommandType.User
                    ? "User: Private target user (selected-user)."
                    : "Message: selected-message. Author: Private target author.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    });
}
