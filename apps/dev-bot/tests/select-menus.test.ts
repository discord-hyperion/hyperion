import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (phase = "new", customId = "colour.choose") =>
    createSelectInteraction(ComponentType.StringSelect, {
        id: "selection",
        customId,
        values: ["blue"],
        user: { id: "user" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

test("development colour command and filesystem menu complete the selection flow", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../", import.meta.url),
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(new URL("../", import.meta.url));
    const command = client.commands.get("colour");
    assert.ok(command);
    const dispatcher = new InteractionDispatcher(client);
    const { interaction: commandInteraction, reply } =
        createChatInputInteraction({
            id: "colour-command",
            commandName: "colour",
            user: { id: "user" },
        });
    await dispatcher.dispatch(commandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /colour.choose/,
    );

    const fixture = interaction();
    const { update } = fixture;
    const template = client.selectMenus
        .get("colour.choose")
        ?.builder?.toJSON(false);
    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(update.mock.calls[0]?.arguments[0], {
        content: "You chose blue.",
        allowedMentions: { parse: [] },
    });
    assert.deepEqual(
        client.selectMenus.get("colour.choose")?.builder?.toJSON(false),
        template,
    );
    assert.equal(fixture.reply.mock.callCount(), 0);
});
