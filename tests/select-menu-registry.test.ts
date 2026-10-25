import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ComponentType, REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenuRegistry } from "../src/registries/index.ts";

const selectMenuModule = new URL(
    "../src/components/select-menu.ts",
    import.meta.url,
).href;
const buildersModule = import.meta.resolve("@discordjs/builders");
const source = (id: string, extra = "") => `
    import { SelectMenu } from ${JSON.stringify(selectMenuModule)};
    import { StringSelectMenuBuilder } from ${JSON.stringify(buildersModule)};
    export default class extends SelectMenu {
        constructor() {
            super({ builder: new StringSelectMenuBuilder()
                .setCustomId(${JSON.stringify(id)}).addOptions({ label: "Blue", value: "blue" }), ${extra} });
        }
        async run() {}
    }
`;

const fixture = async (t: { after: (task: () => Promise<void>) => void }) => {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "hyperion-select-menus-"),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = path.join(root, "src", "select-menus");
    await mkdir(directory, { recursive: true });
    return { root, directory };
};

test("discovers nested select menus deterministically and skips helpers", async t => {
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
        "select-menu.test.ts",
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
    const registry = new SelectMenuRegistry();
    await registry.load(new URL(`file://${root}/`));
    assert.deepEqual([...registry.keys()], ["first", "second"]);
});

test("duplicate custom IDs preserve previously loaded select menus", async t => {
    const { root, directory } = await fixture(t);
    const registry = new SelectMenuRegistry();
    await writeFile(path.join(directory, "first.mjs"), source("same"));
    await registry.load(root);
    const original = registry.get("same");
    await writeFile(path.join(directory, "second.mjs"), source("same"));
    await assert.rejects(
        registry.load(root),
        /Duplicate select menu custom ID "same".*second.mjs/,
    );
    assert.equal(registry.get("same"), original);
});

test("custom IDs have no session-specific reserved prefix", async t => {
    const { root, directory } = await fixture(t);
    const customId = "hyperion:select-menu:ordinary-handler:0";
    await writeFile(path.join(directory, "select-menu.mjs"), source(customId));
    const registry = new SelectMenuRegistry();

    await registry.load(root);

    assert.equal(registry.get(customId)?.customId, customId);
});

for (const [name, contents] of Object.entries({
    "invalid export": "export default class {};",
    "missing run": source("missing-run").replace("async run() {}", ""),
    "invalid builder": source("x".repeat(101)),
    "missing custom ID": source(""),
    "invalid guard": source("guard", "guards: [{}]"),
    "wrong component type": source("wrong")
        .replaceAll("StringSelectMenuBuilder", "ChannelSelectMenuBuilder")
        .replace('.addOptions({ label: "Blue", value: "blue" })', ""),
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
                    /Failed to load select menu.*broken.mjs/,
                );
                assert.ok(error.cause instanceof Error);
                return true;
            },
        );
        assert.equal(destroy.mock.callCount(), 1);
    });
}

test("loads select menus without command deployment and leaves guard factories lazy", async t => {
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
    assert.equal(client.selectMenus.get("lazy")?.guards.length, 1);
    assert.equal(client.commands.size, 0);
    assert.equal(put.mock.callCount(), 0);
    assert.equal(client.isReady(), false);
});

test("missing select menu folders are optional, other filesystem errors propagate", async t => {
    const { root, directory } = await fixture(t);
    const registry = new SelectMenuRegistry();
    await rm(directory, { recursive: true });
    await mkdir(path.join(root, "select-menus"));
    await writeFile(
        path.join(root, "select-menus", "wrong.mjs"),
        source("wrong-location"),
    );
    await registry.load(root);
    assert.equal(registry.size, 0);
    await writeFile(directory, "Not a directory");
    await assert.rejects(registry.load(root), { code: "ENOTDIR" });
});

test("invalid select menus prevent application-command deployment", async t => {
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
        /Failed to load select menu/,
    );
    assert.equal(put.mock.callCount(), 0);
});

const userSource = (id: string) =>
    source(id)
        .replaceAll("StringSelectMenuBuilder", "UserSelectMenuBuilder")
        .replace('.addOptions({ label: "Blue", value: "blue" })', "");

test("loads string, user, and role selects together without REST registration", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(
        path.join(directory, "string.mjs"),
        source("colour.choose"),
    );
    await writeFile(
        path.join(directory, "user.mjs"),
        userSource("user.choose"),
    );
    await writeFile(
        path.join(directory, "role.mjs"),
        roleSource("role.choose"),
    );
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());

    assert.equal(client.selectMenus.size, 3);
    assert.equal(
        client.selectMenus.get("role.choose")?.componentType,
        ComponentType.RoleSelect,
    );
    assert.equal(
        client.selectMenus.get("user.choose")?.builder.toJSON().type,
        ComponentType.UserSelect,
    );
    assert.equal(put.mock.callCount(), 0);
});

test("duplicate IDs across select types preserve the previous registry", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(path.join(directory, "string.mjs"), source("shared"));
    const registry = new SelectMenuRegistry();
    await registry.load(root);
    const original = registry.get("shared");
    await writeFile(path.join(directory, "user.mjs"), userSource("shared"));

    await assert.rejects(
        registry.load(root),
        /Duplicate select menu custom ID/,
    );
    assert.equal(registry.get("shared"), original);
});

test("invalid user select limits retain source context and previous handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(path.join(directory, "valid.mjs"), userSource("valid"));
    const registry = new SelectMenuRegistry();
    await registry.load(root);
    const original = registry.get("valid");
    await writeFile(
        path.join(directory, "invalid.mjs"),
        userSource("invalid").replace(
            '.setCustomId("invalid")',
            '.setCustomId("invalid").setMaxValues(26)',
        ),
    );

    await assert.rejects(registry.load(root), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to load select menu.*invalid.mjs/);
        assert.ok(error.cause instanceof Error);
        return true;
    });
    assert.equal(registry.get("valid"), original);
});

const roleSource = (id: string) =>
    userSource(id).replaceAll("UserSelectMenuBuilder", "RoleSelectMenuBuilder");

test("duplicate role IDs preserve previously loaded handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(path.join(directory, "role.mjs"), roleSource("shared"));
    const registry = new SelectMenuRegistry();
    await registry.load(root);
    const original = registry.get("shared");
    await writeFile(path.join(directory, "string.mjs"), source("shared"));

    await assert.rejects(
        registry.load(root),
        /Duplicate select menu custom ID/,
    );
    assert.equal(registry.get("shared"), original);
});

test("invalid role limits retain source context and previous handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(path.join(directory, "valid.mjs"), roleSource("valid"));
    const registry = new SelectMenuRegistry();
    await registry.load(root);
    const original = registry.get("valid");
    await writeFile(
        path.join(directory, "invalid.mjs"),
        roleSource("invalid").replace(
            '.setCustomId("invalid")',
            '.setCustomId("invalid").setMaxValues(26)',
        ),
    );

    await assert.rejects(registry.load(root), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to load select menu.*invalid.mjs/);
        assert.ok(error.cause instanceof Error);
        return true;
    });
    assert.equal(registry.get("valid"), original);
});
