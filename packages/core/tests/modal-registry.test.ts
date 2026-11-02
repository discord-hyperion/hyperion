import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { ModalRegistry } from "../src/registries/index.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

const modalModule = new URL("../src/components/modal.ts", import.meta.url).href;
const buildersModule = import.meta.resolve("@discordjs/builders");
const source = (id: string, extra = "") => `
    import { Modal } from ${JSON.stringify(modalModule)};
    import { ModalBuilder, LabelBuilder, TextInputBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends Modal {
        constructor() {
            super({ builder: new ModalBuilder()
                .setCustomId(${JSON.stringify(id)}).setTitle("Feedback").addLabelComponents(new LabelBuilder().setLabel("Message").setTextInputComponent(new TextInputBuilder().setCustomId("message").setStyle(1))), ${extra} });
        }
        async run() {}
    }
`;

const fixture = (t: TestContext) =>
    createHandlerRoot(t, "hyperion-modals-", "modals");

test("discovers nested modals deterministically and skips helpers", async t => {
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
        "modal.test.ts",
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
    const registry = new ModalRegistry();
    await registry.load(new URL(`file://${root}/`));
    assert.deepEqual([...registry.keys()], ["first", "second"]);
});

test("duplicate custom IDs preserve previously loaded modals", async t => {
    const { root, directory } = await fixture(t);
    const registry = new ModalRegistry();
    await writeFile(path.join(directory, "first.mjs"), source("same"));
    await registry.load(root);
    const original = registry.get("same");
    await writeFile(path.join(directory, "second.mjs"), source("same"));
    await assert.rejects(
        registry.load(root),
        /Duplicate modal custom ID "same".*second.mjs/,
    );
    assert.equal(registry.get("same"), original);
});

for (const failure of [
    "invalid builder",
    "changed custom ID",
    "import failure",
]) {
    test(`modal reload with ${failure} retains previous handlers and source context`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(path.join(directory, "valid.mjs"), source("valid"));
        const registry = new ModalRegistry();
        await registry.load(root);
        const original = registry.get("valid");
        const broken =
            failure === "import failure"
                ? 'throw new Error("Import failed");'
                : failure === "changed custom ID"
                  ? source("changed").replace(
                        "async run() {}",
                        'changed = this.builder.setCustomId("different"); async run() {}',
                    )
                  : source("x".repeat(101));
        await writeFile(path.join(directory, "broken.mjs"), broken);

        await assert.rejects(registry.load(root), error => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Failed to load modal.*broken.mjs/);
            assert.ok(error.cause instanceof Error);
            return true;
        });
        assert.equal(registry.get("valid"), original);
        assert.equal(registry.size, 1);
    });
}

test("custom IDs have no session-specific reserved prefix", async t => {
    const { root, directory } = await fixture(t);
    const customId = "hyperion:modal:ordinary-handler:0";
    await writeFile(path.join(directory, "modal.mjs"), source(customId));
    const registry = new ModalRegistry();

    await registry.load(root);

    assert.equal(registry.get(customId)?.customId, customId);
});

for (const [name, contents] of Object.entries({
    "invalid export": "export default class {};",
    "missing run": source("missing-run").replace("async run() {}", ""),
    "invalid builder": source("x".repeat(101)),
    "missing custom ID": source(""),
    "invalid guard": source("guard", "guards: [{}]"),
    "wrong builder": source("wrong")
        .replaceAll("ModalBuilder", "PrimaryButtonBuilder")
        .replace(
            '.setTitle("Feedback").addLabelComponents(new LabelBuilder().setLabel("Message").setTextInputComponent(new TextInputBuilder().setCustomId("message").setStyle(1)))',
            '.setLabel("Click")',
        ),
    "missing title": source("title").replace('.setTitle("Feedback")', ""),
    "empty components": source("empty").replace(
        '.setTitle("Feedback").addLabelComponents(new LabelBuilder().setLabel("Message").setTextInputComponent(new TextInputBuilder().setCustomId("message").setStyle(1)))',
        '.setTitle("Empty")',
    ),
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
                assert.match(error.message, /Failed to load modal.*broken.mjs/);
                assert.ok(error.cause instanceof Error);
                return true;
            },
        );
        assert.equal(destroy.mock.callCount(), 1);
    });
}

test("loads modals without command deployment and leaves guard factories lazy", async t => {
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
    assert.equal(client.modals.get("lazy")?.guards.length, 1);
    assert.equal(client.commands.size, 0);
    assert.equal(put.mock.callCount(), 0);
    assert.equal(client.isReady(), false);
});

test("missing modal folders are optional, other filesystem errors propagate", async t => {
    const { root, directory } = await fixture(t);
    const registry = new ModalRegistry();
    await rm(directory, { recursive: true });
    await mkdir(path.join(root, "modals"));
    await writeFile(
        path.join(root, "modals", "wrong.mjs"),
        source("wrong-location"),
    );
    await registry.load(root);
    assert.equal(registry.size, 0);
    await writeFile(directory, "Not a directory");
    await assert.rejects(registry.load(root), { code: "ENOTDIR" });
});

test("invalid modals prevent application-command deployment", async t => {
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
        /Failed to load modal/,
    );
    assert.equal(put.mock.callCount(), 0);
});
