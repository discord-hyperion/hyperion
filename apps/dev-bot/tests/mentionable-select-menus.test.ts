import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { Collection, ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (phase = "new", values = ["role", "person"]) =>
    createSelectInteraction(ComponentType.MentionableSelect, {
        id: "mentionable-selection",
        customId: "mentionable.choose",
        values,
        users: new Collection(
            values.includes("person")
                ? [["person", { id: "person", username: "Selected user" }]]
                : [],
        ),
        roles: new Collection(
            values.includes("role")
                ? [["role", { id: "role", name: "Selected role" }]]
                : [],
        ),
        members: new Collection(),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

for (const [name, values, expected] of [
    ["mixed", ["role", "person"], "Selected role, Selected user"],
    ["users only", ["person"], "Selected user"],
    ["roles only", ["role"], "Selected role"],
    ["empty", [], "None"],
] as const) {
    test(`development mentionable command handles ${name} selections`, async t => {
        const client = await HyperionClient.create({
            name: "Test",
            root: new URL("../", import.meta.url),
            discord: { intents: [] },
            logging: false,
        });
        t.after(() => client.destroy());
        await client.commands.load(new URL("../", import.meta.url));
        const dispatcher = new InteractionDispatcher(client);
        const { interaction: commandInteraction, reply } =
            createChatInputInteraction({
                id: "mentionable-command",
                commandName: "mentionable",
                user: { id: "caller" },
            });
        await dispatcher.dispatch(commandInteraction);
        const payload = reply.mock.calls[0]?.arguments[0] as {
            components: { toJSON(): unknown }[];
        };
        assert.match(
            JSON.stringify(payload.components[0]?.toJSON()),
            /mentionable.choose/,
        );

        const fixture = interaction("new", [...values]);
        const template = client.selectMenus
            .get("mentionable.choose")
            ?.builder.toJSON();
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
            content: `Selected: ${expected}.`,
            allowedMentions: { parse: [] },
        });
        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.deepEqual(
            client.selectMenus.get("mentionable.choose")?.builder.toJSON(),
            template,
        );
    });
}
