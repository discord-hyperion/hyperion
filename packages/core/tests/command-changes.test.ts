import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { REST } from "discord.js";
import pino from "pino";
import { commandChanges as compare } from "../src/registries/command-changes.ts";

const global = { guild: false };
const commandChanges = (local: readonly object[], remote: readonly object[]) =>
    compare(local, remote, global);

import { CommandRegistry } from "../src/registries/index.ts";
import { createTempRoot } from "./support/temp-root.ts";

const commandModule = new URL("../src/commands/command.ts", import.meta.url)
    .href;
const buildersModule = import.meta.resolve("@discordjs/builders");

const local = {
    type: 1,
    name: "todo",
    description: "Manage todos",
    default_member_permissions: "8",
    options: [
        {
            type: 3,
            name: "title",
            description: "The title",
            required: true,
            min_length: 1,
        },
        { type: 5, name: "urgent", description: "Pin it" },
    ],
};

// What Discord returns for the same command: its own fields, and defaults
// filled in for everything the deployment left out.
const registered = {
    id: "1",
    application_id: "123",
    guild_id: "456",
    version: "2",
    type: 1,
    name: "todo",
    name_localizations: null,
    description: "Manage todos",
    description_localizations: null,
    default_member_permissions: "8",
    dm_permission: true,
    nsfw: false,
    integration_types: [0],
    contexts: [2, 1, 0],
    options: [
        {
            type: 3,
            name: "title",
            description: "The title",
            required: true,
            min_length: 1,
        },
        {
            type: 5,
            name: "urgent",
            description: "Pin it",
            required: false,
        },
    ],
};

const none = { added: [], removed: [], changed: [], differences: {} };

test("a command matches its registered copy despite Discord's extra fields", () => {
    assert.deepEqual(commandChanges([local], [registered]), none);
});

test("command order doesn't count as a change, but option order does", () => {
    const other = { type: 1, name: "ping", description: "Pong" };

    assert.deepEqual(commandChanges([other, local], [registered, other]), none);
    assert.deepEqual(
        commandChanges(
            [{ ...local, options: [...local.options].reverse() }],
            [registered],
        ).changed,
        ["todo"],
    );
});

test("changes name the added, removed, and changed commands", () => {
    const ping = { type: 1, name: "ping", description: "Pong" };
    const inspect = { type: 2, name: "Inspect", description: "" };

    assert.deepEqual(
        commandChanges(
            [{ ...local, description: "Manage your todos" }, inspect],
            [registered, ping],
        ),
        {
            added: ["Inspect"],
            removed: ["ping"],
            changed: ["todo"],
            differences: { todo: ["description"] },
        },
    );
});

test("a context menu without a description matches Discord's empty one", () => {
    const inspect = { type: 2, name: "Inspect" };

    assert.deepEqual(
        commandChanges([inspect], [{ ...inspect, id: "1", description: "" }]),
        none,
    );
});

test("differences name the paths of the fields that changed", () => {
    const changes = commandChanges(
        [
            {
                ...local,
                contexts: [0],
                options: [
                    { ...local.options[0], min_length: 2 },
                    local.options[1],
                ],
            },
        ],
        [registered],
    );

    assert.deepEqual(changes.differences, {
        todo: ["contexts", "options[0].min_length"],
    });
});

test("a guild scope ignores the fields that apply only to global commands", () => {
    const select = {
        type: 1,
        name: "select",
        description: "Pick",
        contexts: [0],
    };
    const stored = { ...select, contexts: null };

    assert.deepEqual(compare([select], [stored], { guild: true }), none);
    assert.deepEqual(compare([select], [stored], global).differences, {
        select: ["contexts"],
    });
});

test("a field set back to its default still counts as a change", () => {
    assert.deepEqual(
        commandChanges([local], [{ ...registered, nsfw: true }]).changed,
        ["todo"],
    );
    assert.deepEqual(
        commandChanges(
            [{ ...local, default_member_permissions: null }],
            [registered],
        ).changed,
        ["todo"],
    );
});

test("commands with the same name but a different type are different", () => {
    const user = { type: 2, name: "todo", description: "" };

    assert.deepEqual(commandChanges([user], [registered]), {
        added: ["todo"],
        removed: ["todo"],
        changed: [],
        differences: {},
    });
});

const loadRegistry = async (t: TestContext, prefix: string) => {
    const root = await createTempRoot(t, prefix);
    const directory = path.join(root, "src", "commands");
    const lines: string[] = [];

    await mkdir(directory, { recursive: true });

    await writeFile(
        path.join(directory, "ping.mjs"),
        `
            import { defineCommand } from ${JSON.stringify(commandModule)};
            import { ChatInputCommandBuilder } from ${JSON.stringify(buildersModule)};
            export default defineCommand({
                builder: new ChatInputCommandBuilder()
                    .setName("ping")
                    .setDescription("Pong"),
                async run() {},
            });
        `,
    );

    const registry = new CommandRegistry(
        pino({ level: "debug" }, { write: line => lines.push(line) }),
    );
    await registry.load(root);

    const events = () =>
        lines.map(
            line =>
                JSON.parse(line) as { event?: string; [key: string]: unknown },
        );

    return { registry, events };
};

const options = {
    applicationId: "123",
    token: "test-token",
    guildIds: ["456"],
};

test("registration skips a scope whose commands are unchanged", async t => {
    const { registry, events } = await loadRegistry(t, "hyperion-unchanged-");
    const get = t.mock.method(REST.prototype, "get", async () => [
        { id: "1", version: "1", type: 1, name: "ping", description: "Pong" },
    ]);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await registry.register(options);

    assert.equal(get.mock.callCount(), 1);
    assert.equal(
        get.mock.calls[0]?.arguments[1]?.query?.get("with_localizations"),
        "true",
    );
    assert.equal(put.mock.callCount(), 0);
    assert.ok(events().some(record => record.event === "commands.unchanged"));
});

test("registration deploys and logs what changed", async t => {
    const { registry, events } = await loadRegistry(t, "hyperion-changed-");
    t.mock.method(REST.prototype, "get", async () => [
        { type: 1, name: "old", description: "Gone" },
    ]);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await registry.register(options);

    assert.equal(put.mock.callCount(), 1);
    const deployed = events().find(
        record => record.event === "commands.deployed",
    );
    assert.deepEqual(deployed?.added, ["ping"]);
    assert.deepEqual(deployed?.removed, ["old"]);
    assert.deepEqual(deployed?.changed, []);
});

test("registration deploys everything when it can't read the registered commands", async t => {
    const { registry, events } = await loadRegistry(
        t,
        "hyperion-compare-fail-",
    );

    t.mock.method(REST.prototype, "get", async () => {
        throw new Error("Service unavailable");
    });
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await registry.register(options);

    assert.equal(put.mock.callCount(), 1);
    const records = events();
    assert.ok(
        records.some(record => record.event === "commands.compare_failed"),
    );
    assert.ok(records.some(record => record.event === "commands.deployed"));
    assert.ok(!JSON.stringify(records).includes("test-token"));
});
