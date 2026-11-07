import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ComponentType, MessageFlags } from "discord.js";
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
    const command = client.commands.resolveSubcommand("select", "colour");
    assert.ok(command);
    const dispatcher = new InteractionDispatcher(client);
    const { interaction: commandInteraction, reply } =
        createChatInputInteraction({
            id: "colour-command",
            commandName: "select",
            options: {
                getSubcommand: () => "colour",
                getSubcommandGroup: () => null,
            },
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

test("the colour menu validates its selection before the handler runs", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../", import.meta.url),
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.selectMenus.load(new URL("../", import.meta.url));
    const dispatcher = new InteractionDispatcher(client);
    const fixture = createSelectInteraction(ComponentType.StringSelect, {
        customId: "colour.choose",
        values: ["purple"],
        user: { id: "user" },
    });

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.update.mock.callCount(), 0);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content: "That colour isn't on the list.",
        flags: MessageFlags.Ephemeral,
    });
});
