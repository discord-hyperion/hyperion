import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { HyperionClient, InteractionDispatcher } from "@hyperion/core";
import { MessageFlags, type User } from "discord.js";

import {
    createButtonInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";

type Phase = "new" | "defer-update" | "defer-reply" | "replied";
const interaction = (phase: Phase = "new", userId = "owner") =>
    createButtonInteraction({
        id: `click-${userId}`,
        customId: "refresh",
        guildId: "test-guild",
        user: { id: userId },
        message: {
            id: "test-message",
            interactionMetadata: { user: { id: "owner" } },
        },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

test("development profile command and button complete the async refresh flow", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-profile-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [folder, file, modulePath] of [
        ["commands", "profile", "commands/(components)/profile"],
        ["buttons", "refresh-profile", "buttons/refresh-profile"],
    ] as const) {
        const directory = path.join(root, "src", folder);
        await mkdir(directory, { recursive: true });
        const url = new URL(`../src/${modulePath}.ts`, import.meta.url);
        await writeFile(
            path.join(directory, `${file}.mjs`),
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
    t.mock.method(client, "getOwnerId", async () => "owner");
    await client.commands.load(root);
    const fetch = t.mock.method(
        client.users,
        "fetch",
        async () => ({ username: "Refreshed user" }) as User,
    );
    const dispatcher = new InteractionDispatcher(client);
    const { interaction: commandInteraction, reply } =
        createChatInputInteraction({
            id: "profile-command",
            commandName: "profile",
            user: { id: "owner" },
        });
    await dispatcher.dispatch(commandInteraction);
    assert.equal(reply.mock.callCount(), 1);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        flags: number;
        components: { toJSON(): unknown }[];
    };
    assert.equal(payload.flags, MessageFlags.Ephemeral);
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /profile.refresh/,
    );

    const button = client.buttons.get("profile.refresh");
    const template = button?.builder?.toJSON(false);
    const fixture = interaction();
    Object.assign(fixture.interaction, { customId: "profile.refresh" });
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(fetch.mock.callCount(), 1);
    assert.deepEqual(fetch.mock.calls[0]?.arguments, [
        "owner",
        { force: true },
    ]);
    const edited = fixture.editReply.mock.calls[0]?.arguments[0] as {
        content: string;
    };
    assert.equal(edited.content, "Profile refreshed: Refreshed user");
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.deepEqual(button?.builder?.toJSON(false), template);
});
