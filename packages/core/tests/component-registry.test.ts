import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { componentKinds } from "./support/component-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

const nodeModuleIgnored = 'throw new Error("Must not import");';

for (const kind of componentKinds) {
    const { noun, folder, property, source } = kind;
    const fixture = (t: Parameters<typeof createHandlerRoot>[0]) =>
        createHandlerRoot(t, `hyperion-${folder}-`, folder);

    describe(`${noun} registry`, () => {
        test("discovers nested handlers deterministically and skips helpers", async t => {
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
                "handler.test.ts",
                ".hidden.ts",
                "notes.txt",
            ]) {
                await writeFile(path.join(directory, file), nodeModuleIgnored);
            }
            await mkdir(path.join(directory, "node_modules"));

            await writeFile(
                path.join(directory, "node_modules", "ignored.mjs"),
                nodeModuleIgnored,
            );

            const registry = new kind.Registry();
            await registry.load(new URL(`file://${root}/`));

            assert.deepEqual([...registry.keys()], ["first", "second"]);
        });

        test("duplicate custom IDs preserve previously loaded handlers", async t => {
            const { root, directory } = await fixture(t);
            const registry = new kind.Registry();
            await writeFile(path.join(directory, "first.mjs"), source("same"));
            await registry.load(root);
            const original = registry.get("same");
            await writeFile(path.join(directory, "second.mjs"), source("same"));

            await assert.rejects(
                registry.load(root),
                new RegExp(`Duplicate ${noun} custom ID "same".*second.mjs`),
            );

            assert.equal(registry.get("same"), original);
        });

        test("custom IDs have no session-specific reserved prefix", async t => {
            const { root, directory } = await fixture(t);
            const customId = `hyperion:${folder.replace(/s$/, "")}:ordinary-handler:0`;

            await writeFile(
                path.join(directory, "handler.mjs"),
                source(customId),
            );

            const registry = new kind.Registry();

            await registry.load(root);

            assert.equal(registry.get(customId)?.customId, customId);
        });

        const broken = {
            "invalid export": "export default class {};",
            "missing run": source("missing-run").replace("async run() {},", ""),
            "invalid builder": source("x".repeat(101)),
            "missing custom ID": source(""),
            "invalid guard": source("guard", "guards: [{}]"),
            ...kind.brokenModules,
        };
        for (const [name, contents] of Object.entries(broken)) {
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
                            new RegExp(`Failed to load ${noun}.*broken.mjs`),
                        );
                        assert.ok(error.cause instanceof Error);

                        return true;
                    },
                );

                assert.equal(destroy.mock.callCount(), 1);
            });
        }

        test("loads handlers without command deployment and leaves guard factories lazy", async t => {
            const { root, directory } = await fixture(t);

            await writeFile(
                path.join(directory, "lazy.mjs"),
                source(
                    "lazy",
                    'guards: [() => { throw new Error("Not during startup"); }]',
                ),
            );

            t.mock.method(REST.prototype, "get", async () => []);
            const put = t.mock.method(REST.prototype, "put", async () => []);

            const client = await HyperionClient.create({
                name: "Test",
                root,
                discord: { intents: [] },
                logging: false,
            });

            t.after(() => client.destroy());

            assert.equal(client[property].get("lazy")?.guards.length, 1);
            assert.equal(client.commands.size, 0);
            assert.equal(put.mock.callCount(), 0);
            assert.equal(client.isReady(), false);
        });

        test("missing folders are optional, other filesystem errors propagate", async t => {
            const { root, directory } = await fixture(t);
            const registry = new kind.Registry();
            await rm(directory, { recursive: true });
            // A folder outside `src` must not be discovered.
            await mkdir(path.join(root, folder));

            await writeFile(
                path.join(root, folder, "wrong.mjs"),
                source("wrong-location"),
            );

            await registry.load(root);

            assert.equal(registry.size, 0);

            await writeFile(directory, "Not a directory");

            await assert.rejects(registry.load(root), { code: "ENOTDIR" });
        });

        test("invalid handlers prevent application-command deployment", async t => {
            const { root, directory } = await fixture(t);
            const commands = path.join(root, "src", "commands");
            await mkdir(commands);

            await writeFile(
                path.join(commands, "ping.mjs"),
                `
        import { defineCommand } from ${JSON.stringify(new URL("../src/commands/command.ts", import.meta.url).href)};
        import { ChatInputCommandBuilder } from ${JSON.stringify(import.meta.resolve("@discordjs/builders"))};
        export default defineCommand({
            builder: new ChatInputCommandBuilder().setName("ping").setDescription("Ping"),
            async run() {},
        })
    `,
            );

            await writeFile(
                path.join(directory, "bad.mjs"),
                "export default class {};",
            );

            t.mock.method(REST.prototype, "get", async () => []);
            const put = t.mock.method(REST.prototype, "put", async () => []);

            await assert.rejects(
                HyperionClient.create({
                    name: "Test",
                    root,
                    discord: { intents: [] },
                    logging: false,
                    commands: { applicationId: "123", token: "test-token" },
                }),
                new RegExp(`Failed to load ${noun}`),
            );

            assert.equal(put.mock.callCount(), 0);
        });
    });
}
