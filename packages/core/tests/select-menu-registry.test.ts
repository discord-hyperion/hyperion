import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { ComponentType, REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenuRegistry } from "../src/registries/index.ts";
import { selectMenuKind } from "./support/component-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

// Shared registry behaviour lives in component-registry.test.ts.
const { source } = selectMenuKind;

const fixture = (t: TestContext) =>
    createHandlerRoot(t, "hyperion-select-menus-", "select-menus");

const userSource = (id: string) =>
    source(id)
        .replaceAll("StringSelectMenuBuilder", "UserSelectMenuBuilder")
        .replace('.addOptions({ label: "Blue", value: "blue" })', "");

test("loads all supported selects together without REST registration", async t => {
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
    await writeFile(
        path.join(directory, "mentionable.mjs"),
        mentionableSource("mentionable.choose"),
    );
    await writeFile(
        path.join(directory, "channel.mjs"),
        channelSource("channel.choose"),
    );
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());

    assert.equal(client.selectMenus.size, 5);
    assert.equal(
        client.selectMenus.get("channel.choose")?.componentType,
        ComponentType.ChannelSelect,
    );
    assert.equal(
        client.selectMenus.get("mentionable.choose")?.componentType,
        ComponentType.MentionableSelect,
    );
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

const channelSource = (id: string) =>
    userSource(id).replaceAll(
        "UserSelectMenuBuilder",
        "ChannelSelectMenuBuilder",
    );

test("duplicate channel IDs preserve previously loaded handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(
        path.join(directory, "channel.mjs"),
        channelSource("shared"),
    );
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

for (const setting of ["setMaxValues(26)", "setChannelTypes(999)"]) {
    test(`invalid channel ${setting} retains source context and previous handlers`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(
            path.join(directory, "valid.mjs"),
            channelSource("valid"),
        );
        const registry = new SelectMenuRegistry();
        await registry.load(root);
        const original = registry.get("valid");
        await writeFile(
            path.join(directory, "invalid.mjs"),
            channelSource("invalid").replace(
                '.setCustomId("invalid")',
                `.setCustomId("invalid").${setting}`,
            ),
        );

        await assert.rejects(registry.load(root), error => {
            assert.ok(error instanceof Error);
            assert.match(
                error.message,
                /Failed to load select menu.*invalid.mjs/,
            );
            assert.ok(error.cause instanceof Error);
            return true;
        });
        assert.equal(registry.get("valid"), original);
    });
}

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

const mentionableSource = (id: string) =>
    userSource(id).replaceAll(
        "UserSelectMenuBuilder",
        "MentionableSelectMenuBuilder",
    );

test("duplicate mentionable IDs preserve previously loaded handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(
        path.join(directory, "mentionable.mjs"),
        mentionableSource("shared"),
    );
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

test("invalid mentionable limits retain source context and previous handlers", async t => {
    const { root, directory } = await fixture(t);
    await writeFile(
        path.join(directory, "valid.mjs"),
        mentionableSource("valid"),
    );
    const registry = new SelectMenuRegistry();
    await registry.load(root);
    const original = registry.get("valid");
    await writeFile(
        path.join(directory, "invalid.mjs"),
        mentionableSource("invalid").replace(
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
