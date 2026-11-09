import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion-js/core";
import { Collection, ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (phase = "new", ids = ["selected"]) =>
    createSelectInteraction(ComponentType.UserSelect, {
        id: "user-selection",
        customId: "user.choose",
        values: ids,
        users: new Collection(
            ids.map(id => [id, { id, username: `name-${id}` }]),
        ),
        members: new Collection(),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

test("development user command and filesystem menu complete the selection flow", async t => {
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
            id: "user-command",
            commandName: "select",
            options: {
                getSubcommand: () => "user",
                getSubcommandGroup: () => null,
            },
            user: { id: "caller" },
        });
    await dispatcher.dispatch(commandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /user.choose/,
    );

    const fixture = interaction();
    const template = client.selectMenus
        .get("user.choose")
        ?.builder?.toJSON(false);
    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
        content: "Selected users: name-selected.",
        allowedMentions: { parse: [] },
    });
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.deepEqual(
        client.selectMenus.get("user.choose")?.builder?.toJSON(false),
        template,
    );
});
