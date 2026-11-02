import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { ButtonRegistry } from "../src/registries/index.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

const buttonModule = new URL("../src/components/button.ts", import.meta.url)
    .href;
const buildersModule = import.meta.resolve("@discordjs/builders");
const source = (id: string, extra = "") => `
    import { Button } from ${JSON.stringify(buttonModule)};
    import { PrimaryButtonBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends Button {
        constructor() {
            super({ builder: new PrimaryButtonBuilder()
                .setCustomId(${JSON.stringify(id)}).setLabel("Click"), ${extra} });
        }
        async run() {}
    }
`;

const fixture = (t: TestContext) =>
    createHandlerRoot(t, "hyperion-buttons-", "buttons");

test("discovers nested buttons deterministically and skips helpers", async t => {
    const { root, directory } = await fixture(t);
    await mkdir(path.join(directory, "nested"));
    await writeFile(path.join(directory, "first.mjs"), source("first"));
    await writeFile(
        path.join(directory, "nested", "second.mjs"),
        source("second"),
    );
    for (const file of [
        "index.ts",
        "types.d.ts",
        "button.test.ts",
        ".hidden.ts",
        "notes.txt",
    ]) {
        await writeFile(
            path.join(directory, file),
            'throw new Error("Must not import");',
        );
    }
    await mkdir(path.join(directory, "node_modules"));
    await writeFile(
        path.join(directory, "node_modules", "ignored.mjs"),
        'throw new Error("Must not import");',
    );
    const registry = new ButtonRegistry();
    await registry.load(new URL(`file://${root}/`));
    assert.deepEqual([...registry.keys()], ["first", "second"]);
});

test("duplicate custom IDs preserve previously loaded buttons", async t => {
    const { root, directory } = await fixture(t);
    const registry = new ButtonRegistry();
    await writeFile(path.join(directory, "first.mjs"), source("same"));
    await registry.load(root);
    const original = registry.get("same");
    await writeFile(path.join(directory, "second.mjs"), source("same"));
    await assert.rejects(
        registry.load(root),
        /Duplicate button custom ID "same".*second.mjs/,
    );
    assert.equal(registry.get("same"), original);
});

test("custom IDs have no session-specific reserved prefix", async t => {
    const { root, directory } = await fixture(t);
    const customId = "hyperion:button:ordinary-handler:0";
    await writeFile(path.join(directory, "button.mjs"), source(customId));
    const registry = new ButtonRegistry();

    await registry.load(root);

    assert.equal(registry.get(customId)?.customId, customId);
});

for (const [name, contents] of Object.entries({
    "invalid export": "export default class {};",
    "missing run": source("missing-run").replace("async run() {}", ""),
    "invalid builder": source("x".repeat(101)),
    "missing custom ID": source(""),
    "invalid guard": source("guard", "guards: [{}]"),
    "link button": source("link")
        .replaceAll("PrimaryButtonBuilder", "LinkButtonBuilder")
        .replace('.setCustomId("link")', '.setURL("https://example.com")'),
})) {
    test(`${name} fails initialization with its source and original cause`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(path.join(directory, "broken.mjs"), contents);
        const destroy = t.mock.method(
            HyperionClient.prototype,
            "destroy",
            async () => {},
        );
        await assert.rejects(
            HyperionClient.create({
                name: "Test",
                root,
                discord: { intents: [] },
                logging: false,
            }),
            error => {
                assert.ok(error instanceof Error);
                assert.match(
                    error.message,
                    /Failed to load button.*broken.mjs/,
                );
                assert.ok(error.cause instanceof Error);
                return true;
            },
        );
        assert.equal(destroy.mock.callCount(), 1);
    });
}

test("loads buttons without command deployment and leaves guard factories lazy", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(
        path.join(directory, "lazy.mjs"),
        source(
            "lazy",
            'guards: [() => { throw new Error("Not during startup"); }]',
        ),
    );
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    assert.equal(client.buttons.get("lazy")?.guards.length, 1);
    assert.equal(client.commands.size, 0);
    assert.equal(put.mock.callCount(), 0);
    assert.equal(client.isReady(), false);
});

test("missing button folders are optional, other filesystem errors propagate", async t => {
    const { root, directory } = await fixture(t);
    const registry = new ButtonRegistry();
    await rm(directory, { recursive: true });
    await mkdir(path.join(root, "buttons"));
    await writeFile(
        path.join(root, "buttons", "wrong.mjs"),
        source("wrong-location"),
    );
    await registry.load(root);
    assert.equal(registry.size, 0);
    await writeFile(directory, "Not a directory");
    await assert.rejects(registry.load(root), { code: "ENOTDIR" });
});

test("invalid buttons prevent application-command deployment", async t => {
    const { root, directory } = await fixture(t);
    const commands = path.join(root, "src", "commands");
    await mkdir(commands);
    const commandModule = new URL("../src/commands/command.ts", import.meta.url)
        .href;
    await writeFile(
        path.join(commands, "ping.mjs"),
        `
        import { Command } from ${JSON.stringify(commandModule)};
        import { ChatInputCommandBuilder } from ${JSON.stringify(buildersModule)};
        export default class extends Command {
            constructor() { super({ builder: new ChatInputCommandBuilder().setName("ping").setDescription("Ping") }); }
            async run() {}
        }
    `,
    );
    await writeFile(
        path.join(directory, "bad.mjs"),
        "export default class {};",
    );
    const put = t.mock.method(REST.prototype, "put", async () => []);
    await assert.rejects(
        HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            logging: false,
            commands: { applicationId: "123", token: "test-token" },
        }),
        /Failed to load button/,
    );
    assert.equal(put.mock.callCount(), 0);
});
