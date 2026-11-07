import assert from "node:assert/strict";
import { test } from "node:test";
import { HyperionClient } from "@hyperion/core";
import { REST } from "discord.js";
import {
    createAutocompleteInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (
    subcommand: string | null,
    group: string | null = null,
    autocomplete = false,
) => {
    const data = {
        id: "subcommand-interaction",
        commandName: "tools",
        user: { id: "allowed" },
        guildId: "guild",
        options: {
            getSubcommand: () => subcommand,
            getSubcommandGroup: () => group,
        },
    };

    return autocomplete
        ? createAutocompleteInteraction(data)
        : createChatInputInteraction(data);
};

test("development subcommands load and execute through the client listener", async t => {
    const put = t.mock.method(REST.prototype, "put", async () => []);

    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../", import.meta.url),
        discord: { intents: [] },
        logging: false,
        commands: {
            applicationId: "123",
            token: "fake-token",
            guildIds: ["456"],
        },
    });

    t.after(() => client.destroy());
    const version = interaction("version", "runtime");

    client.emit("interactionCreate", version.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(put.mock.callCount(), 1);
    assert.match(
        JSON.stringify(version.reply.mock.calls[0]?.arguments[0]),
        new RegExp(process.version.replaceAll(".", "\\.")),
    );
    assert.ok(client.commands.resolve("ping"));
    assert.ok(client.commands.resolveSubcommand("tools", "echo"));
});
