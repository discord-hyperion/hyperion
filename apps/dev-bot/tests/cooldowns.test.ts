import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { MessageFlags } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";

const setup = async (t: TestContext) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-cooldown-"));
    const directory = path.join(root, "src", "commands", "[cooldown]");

    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(directory, { recursive: true });

    for (const name of ["index", "guard", "sqlite"]) {
        const url = new URL(
            `../src/commands/[cooldown]/${name}.ts`,
            import.meta.url,
        );

        await writeFile(
            path.join(directory, `${name}.mjs`),
            `export { default } from ${JSON.stringify(url.href)};`,
        );
    }

    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: false,
    });

    t.after(() => client.destroy());
    await client.commands.load(root);
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

    const dispatcher = new InteractionDispatcher(client);
    const run = async (subcommand: string, userId: string) => {
        const fixture = createChatInputInteraction({
            commandName: "cooldown",
            options: {
                getSubcommand: () => subcommand,
                getSubcommandGroup: () => null,
            },
            user: { id: userId },
        });

        await dispatcher.dispatch(fixture.interaction);

        return fixture.reply.mock.calls[0]?.arguments[0];
    };

    return { run, tick: (ms: number) => t.mock.timers.tick(ms) };
};

test("/cooldown guard rejects a second run within 10 seconds", async t => {
    const { run, tick } = await setup(t);
    const done =
        "Done. Run it again within 10 seconds and the guard stops you.";

    assert.equal(await run("guard", "guard-user"), done);
    assert.deepEqual(await run("guard", "guard-user"), {
        content: "Please wait before using this interaction again.",
        flags: MessageFlags.Ephemeral,
    });
    assert.equal(await run("guard", "someone-else"), done);
    tick(10_000);

    assert.equal(await run("guard", "guard-user"), done);
});

test("/cooldown sqlite stores the cooldown and says when it ends", async t => {
    const { run, tick } = await setup(t);
    const done = "Done. Run it again within 10 seconds and SQLite remembers.";

    assert.equal(await run("sqlite", "sqlite-user"), done);
    tick(4_000);

    assert.deepEqual(await run("sqlite", "sqlite-user"), {
        content: "Slow down! Try again <t:1010:R>.",
        flags: MessageFlags.Ephemeral,
    });
    tick(6_000);

    assert.equal(await run("sqlite", "sqlite-user"), done);
});
