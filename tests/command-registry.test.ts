import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { DiscordAPIError, REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { CommandRegistry } from "../src/registries/index.ts";

const commandModule = new URL("../src/commands/command.ts", import.meta.url)
    .href;

const buildersModule = import.meta.resolve("@discordjs/builders");

const commandSource = (name: string) => {
    return `
        import { Command } from ${JSON.stringify(commandModule)};
        import { ChatInputCommandBuilder } from ${JSON.stringify(buildersModule)};
        export default class extends Command {
            constructor() {
                super({ builder: new ChatInputCommandBuilder()
                    .setName(${JSON.stringify(name)})
                    .setDescription("A test command")
                    .setDefaultMemberPermissions(8n)
                    .addStringOptions(option => option
                        .setName("query")
                        .setDescription("Search")
                        .setMinLength(1))
                });
            }
            async run() {}
        }
    `;
};

test("discovers nested commands and skips non-command files", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-commands-"));

    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });

    await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
    await mkdir(path.join(directory, "nested"));
    await writeFile(path.join(directory, "ping.mjs"), commandSource("ping"));
    await writeFile(
        path.join(directory, "nested", "status.ts"),
        commandSource("status"),
    );
    for (const file of [
        "index.ts",
        "types.d.ts",
        "helper.test.ts",
        "notes.txt",
    ]) {
        await writeFile(
            path.join(directory, file),
            'throw new Error("Must not import");',
        );
    }

    const registry = new CommandRegistry();
    await registry.load(pathToFileURL(`${root}${path.sep}`));
    assert.deepEqual([...registry.keys()].sort(), ["ping", "status"]);
});

test("rejects duplicate names without replacing the loaded registry", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-duplicate-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "first.mjs"), commandSource("ping"));
    const registry = new CommandRegistry();
    await registry.load(root);
    const original = registry.get("ping");
    await writeFile(path.join(directory, "second.mjs"), commandSource("ping"));
    await assert.rejects(registry.load(root), /Duplicate command name/);
    assert.equal(registry.get("ping"), original);
});

test("rejects invalid exports and skips missing command directories without REST calls", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-invalid-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    const put = t.mock.method(REST.prototype, "put", async () => []);
    await writeFile(
        path.join(directory, "bad.mjs"),
        "export default class {};",
    );
    const registry = new CommandRegistry();
    await assert.rejects(registry.load(root), /Failed to load command/);
    await registry.load(path.join(root, "missing"));
    assert.equal(registry.size, 0);
    assert.equal(put.mock.callCount(), 0);
});

test("initializes commands and bulk registers once per unique guild without login", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-init-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "ping.mjs"), commandSource("ping"));
    const requests: { route: string; body: unknown }[] = [];
    t.mock.method(
        REST.prototype,
        "put",
        async (route: string, options: { body: unknown }) => {
            requests.push({ route, body: options.body });
            return [];
        },
    );

    const client = await HyperionClient.create({
        name: "Test",
        logging: false as const,
        discord: { intents: [] },
        root,
        commands: {
            applicationId: "123",
            token: "test-token",
            guildIds: ["456", "789", "456"],
        },
    });
    t.after(() => client.destroy());
    assert.equal(client.commands.has("ping"), true);
    assert.equal(client.isReady(), false);
    assert.deepEqual(
        requests.map(request => request.route),
        [
            "/applications/123/guilds/456/commands",
            "/applications/123/guilds/789/commands",
        ],
    );
    assert.deepEqual(
        requests[0]?.body,
        client.commands.map(command => command.builder.toJSON()),
    );
    const payload = client.commands.get("ping")?.builder.toJSON();
    assert.equal(payload?.default_member_permissions, "8");
    assert.equal(payload?.options?.[0]?.name, "query");
});

test("supports global registration and rejects unsafe empty configuration", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-global-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const registry = new CommandRegistry();
    const options = { applicationId: "123", token: "test-token" };
    await registry.load(root);
    await assert.rejects(registry.register(options), /No commands were found/);
    await writeFile(path.join(directory, "ping.mjs"), commandSource("ping"));
    await registry.load(root);
    await assert.rejects(
        registry.register({ ...options, guildIds: [] }),
        /at least one guild/,
    );
    await assert.rejects(
        registry.register({ ...options, token: "" }),
        /application ID and bot token/,
    );
    assert.equal(put.mock.callCount(), 0);
    await registry.register(options);
    assert.equal(put.mock.callCount(), 1);
    assert.equal(put.mock.calls[0]?.arguments[0], "/applications/123/commands");
});

test("initialization rejects when deployment fails", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-failure-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "ping.mjs"), commandSource("ping"));
    t.mock.method(REST.prototype, "put", async () => {
        throw new Error("Deployment failed");
    });
    await assert.rejects(
        HyperionClient.create({
            name: "Test",
            logging: false as const,
            discord: { intents: [] },
            root,
            commands: { applicationId: "123", token: "test-token" },
        }),
        /Deployment failed/,
    );
});

test("maps indexed Discord errors to builder command source files", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-api-error-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "a.mjs"), commandSource("ping"));
    const invalidName = "status";
    const invalidFile = path.join(directory, "b.mjs");
    await writeFile(invalidFile, commandSource(invalidName));
    const registry = new CommandRegistry();
    await registry.load(root);
    assert.equal(registry.size, 2);

    const apiError = new DiscordAPIError(
        {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                "1": {
                    description: {
                        _errors: [
                            {
                                code: "BASE_TYPE_BAD_LENGTH",
                                message: "Must be between 1 and 100 in length.",
                            },
                        ],
                    },
                },
            },
        },
        50035,
        400,
        "PUT",
        "https://discord.com/api/v10/applications/123/commands",
        {
            body: registry.map(command => command.builder.toJSON()),
            files: undefined,
        },
    );
    const put = t.mock.method(REST.prototype, "put", async () => {
        throw apiError;
    });

    await assert.rejects(
        registry.register({
            applicationId: "123",
            token: "test-token",
        }),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal(error.cause, apiError);
            assert.ok(error.message.includes("Invalid Form Body"));
            assert.ok(error.message.includes("/applications/123/commands"));
            assert.ok(
                error.message.includes(
                    `body[1]: "${invalidName}" (${invalidFile})`,
                ),
            );
            assert.ok(error.message.includes("1.description"));
            assert.ok(!error.message.includes("a.mjs"));
            return true;
        },
    );
    assert.equal(put.mock.callCount(), 1);
});

test("still rejects commands without an executable run method", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-no-handler-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    await writeFile(
        path.join(directory, "bad.mjs"),
        commandSource("ping").replace("async run() {}", ""),
    );
    await assert.rejects(new CommandRegistry().load(root), /run\(\) method/);
});

test("initialization skips absent or empty conventional folders and ignores other locations", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-conventions-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const put = t.mock.method(REST.prototype, "put", async () => []);
    await mkdir(path.join(root, "commands"));
    await writeFile(
        path.join(root, "commands", "ping.mjs"),
        commandSource("ping"),
    );
    await mkdir(path.join(root, "src", "select-menus"), { recursive: true });
    await writeFile(
        path.join(root, "src", "select-menus", "other.mjs"),
        'throw new Error("Not a command");',
    );

    const options = {
        name: "Test",
        logging: false as const,
        root,
        discord: { intents: [] },
        commands: { applicationId: "123", token: "test-token" },
    };
    const missing = await HyperionClient.create(options);
    t.after(() => missing.destroy());
    assert.equal(missing.commands.size, 0);

    await mkdir(path.join(root, "src", "commands"));
    const empty = await HyperionClient.create(options);
    t.after(() => empty.destroy());
    assert.equal(empty.commands.size, 0);
    assert.equal(put.mock.callCount(), 0);

    const absentRoot = await HyperionClient.create({
        ...options,
        root: path.join(root, "absent"),
    });
    t.after(() => absentRoot.destroy());
    assert.equal(absentRoot.commands.size, 0);
    assert.equal(put.mock.callCount(), 0);
});

test("does not suppress filesystem errors other than a missing folder", async t => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-not-directory-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "commands"), "not a directory");
    await assert.rejects(new CommandRegistry().load(root), /ENOTDIR/);
});

test("builder validation errors identify the source and prevent deployment", async t => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-builder-error-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "commands");
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, "invalid.mjs");
    await writeFile(
        file,
        commandSource("ping").replace(
            '.setDescription("A test command")',
            '.setDescription("")',
        ),
    );
    const registry = new CommandRegistry();
    await registry.load(root);
    const put = t.mock.method(REST.prototype, "put", async () => []);
    await assert.rejects(
        registry.register({ applicationId: "123", token: "test-token" }),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes(file));
            assert.ok(error.cause instanceof Error);
            return true;
        },
    );
    assert.equal(put.mock.callCount(), 0);
});
