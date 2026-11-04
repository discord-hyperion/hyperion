import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { ChannelType, Collection, ComponentType } from "discord.js";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (phase = "new", ids = ["selected"]) =>
    createSelectInteraction(ComponentType.ChannelSelect, {
        id: "channel-selection",
        customId: "channel.choose",
        values: ids,
        channels: new Collection(
            ids.map(id => [
                id,
                {
                    id,
                    name: `name-${id}`,
                    type: ChannelType.GuildText,
                },
            ]),
        ),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

for (const [label, ids, expected] of [
    ["multiple", ["second", "first"], "name-second, name-first"],
    ["empty", [], "None"],
    ["unnamed", ["unnamed"], "unnamed"],
    ["missing", ["missing"], "missing"],
] as const) {
    test(`development channel command and filesystem menu handle ${label} selections`, async t => {
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
                id: "channel-command",
                commandName: "channel",
                user: { id: "caller" },
            });
        await dispatcher.dispatch(commandInteraction);
        const payload = reply.mock.calls[0]?.arguments[0] as {
            components: { toJSON(): unknown }[];
        };
        assert.match(
            JSON.stringify(payload.components[0]?.toJSON()),
            /channel.choose/,
        );
        const menu = client.selectMenus.get("channel.choose");
        assert.ok(menu);
        assert.equal(menu.componentType, ComponentType.ChannelSelect);
        assert.deepEqual(menu.builder?.toJSON(false).channel_types, [
            ChannelType.GuildText,
            ChannelType.GuildVoice,
        ]);

        const fixture = interaction("new", [...ids]);

        if (label === "unnamed") {
            Object.assign(fixture.interaction.channels.get("unnamed") ?? {}, {
                name: null,
            });
        } else if (label === "missing") {
            fixture.interaction.channels.clear();
        }

        const template = client.selectMenus
            .get("channel.choose")
            ?.builder?.toJSON(false);
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
            content: `Selected channels: ${expected}.`,
            allowedMentions: { parse: [] },
        });
        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.deepEqual(
            client.selectMenus.get("channel.choose")?.builder?.toJSON(false),
            template,
        );
    });
}
