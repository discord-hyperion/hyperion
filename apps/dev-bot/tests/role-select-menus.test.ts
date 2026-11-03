import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { Collection, ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (phase = "new", ids = ["selected"]) =>
    createSelectInteraction(ComponentType.RoleSelect, {
        id: "role-selection",
        customId: "role.choose",
        values: ids,
        roles: new Collection(ids.map(id => [id, { id, name: `name-${id}` }])),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

test("development role command and filesystem menu complete the selection flow", async t => {
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
            id: "role-command",
            commandName: "role",
            user: { id: "caller" },
        });
    await dispatcher.dispatch(commandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /role.choose/,
    );

    const fixture = interaction();
    const template = client.selectMenus
        .get("role.choose")
        ?.builder?.toJSON(false);
    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
        content: "Selected roles: name-selected.",
        allowedMentions: { parse: [] },
    });
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.deepEqual(
        client.selectMenus.get("role.choose")?.builder?.toJSON(false),
        template,
    );
});
