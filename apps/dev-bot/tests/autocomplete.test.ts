import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, type TestContext, test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    REST,
} from "discord.js";

import {
    createAutocompleteInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";

const interaction = (
    input = "private-query",
    name = "query",
    type: AutocompleteFocusedOption["type"] = ApplicationCommandOptionType.String,
) => {
    const getFocused = mock.fn(() => ({
        name,
        value: input,
        type,
        focused: true as const,
    }));

    return {
        ...createAutocompleteInteraction({
            id: "autocomplete-request",
            commandName: "search",
            guildId: "guild",
            user: { id: "caller" },
            options: { getFocused },
        }),
        getFocused,
    };
};

const setup = async (t: TestContext, level: "debug" | "info" = "debug") => {
    const records: Record<string, unknown>[] = [];

    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level,
            pretty: false,
            progress: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });

    t.after(() => client.destroy());

    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

test("discovery and mocked registration preserve autocomplete flags without executing hooks or guards", async t => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-autocomplete-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src", "commands"), { recursive: true });
    const commandModule = import.meta.resolve("@hyperion/core");
    const buildersModule = import.meta.resolve("@discordjs/builders");

    await writeFile(
        path.join(root, "src", "commands", "search.mjs"),
        `
        import { defineCommand } from ${JSON.stringify(commandModule)};
        import { ChatInputCommandBuilder } from ${JSON.stringify(buildersModule)};
        export default defineCommand({
            builder: new ChatInputCommandBuilder().setName("search").setDescription("Search")
                    .addStringOptions(option => option.setName("query").setDescription("Query").setAutocomplete(true))
                    .addIntegerOptions(option => option.setName("count").setDescription("Count").setAutocomplete(true))
                    .addNumberOptions(option => option.setName("amount").setDescription("Amount").setAutocomplete(true)),
                    guards: [() => { throw new Error("Not during startup"); }],
            async autocomplete() { throw new Error("Not during startup"); },
            async run() {},
        })
    `,
    );

    t.mock.method(REST.prototype, "get", async () => []);
    const put = t.mock.method(
        REST.prototype,
        "put",
        async (_route: unknown, _options: unknown) => [],
    );

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
        commands: { applicationId: "123", token: "test-token" },
    });

    t.after(() => client.destroy());
    assert.equal(put.mock.callCount(), 1);
    const payload = put.mock.calls[0]?.arguments[1] as {
        body: { options: { autocomplete: boolean }[] }[];
    };
    assert.equal(payload.body[0]?.options.length, 3);
    assert.ok(payload.body[0]?.options.every(option => option.autocomplete));
    assert.equal(client.isReady(), false);
});

for (const [query, expected] of [
    ["MoD", [{ name: "Modals", value: "modals" }]],
    ["select", [{ name: "Select menus", value: "select-menus" }]],
    ["not-a-topic", []],
] as const) {
    test(`development topic autocomplete handles ${query} and normal execution validates submitted values`, async t => {
        const { client, dispatcher } = await setup(t);
        await client.commands.load(new URL("../", import.meta.url));
        const fixture = interaction(query);
        Object.assign(fixture.interaction, { commandName: "topic" });
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(fixture.respond.mock.callCount(), 1);
        assert.deepEqual(fixture.respond.mock.calls[0]?.arguments[0], expected);
        assert.equal(fixture.reply.mock.callCount(), 0);
        const selected = expected[0]?.value ?? "not-a-topic";
        const { interaction: commandInteraction, reply } =
            createChatInputInteraction({
                id: "topic-command",
                commandName: "topic",
                user: { id: "caller" },
                options: { getString: () => selected },
            });
        await dispatcher.dispatch(commandInteraction);

        assert.equal(reply.mock.callCount(), 1);
        const payload = reply.mock.calls[0]?.arguments[0] as {
            content: string;
        };
        assert.ok(
            payload.content.includes(
                expected.length ? expected[0].name : "not available",
            ),
        );
    });
}

test("development topic autocomplete returns initial suggestions and handles unexpected focused options", async t => {
    const { client, dispatcher } = await setup(t);
    await client.commands.load(new URL("../", import.meta.url));
    const initial = interaction("");
    Object.assign(initial.interaction, { commandName: "topic" });
    await dispatcher.dispatch(initial.interaction);
    const choices = initial.respond.mock.calls[0]?.arguments[0];
    assert.ok(choices?.length);
    assert.ok(choices.length <= 25);
    assert.ok(
        choices.every(
            choice =>
                typeof choice.name === "string" &&
                typeof choice.value === "string",
        ),
    );

    const unexpected = interaction("", "other");
    Object.assign(unexpected.interaction, { commandName: "topic" });
    await dispatcher.dispatch(unexpected.interaction);
    assert.deepEqual(unexpected.respond.mock.calls[0]?.arguments[0], []);
});
