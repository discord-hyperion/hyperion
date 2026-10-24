import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, Client, REST } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { Command, type CommandContext } from "../src/commands/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { LogManager } from "../src/logging/index.ts";

interface LogRecord {
    event?: string;
    level: number;
    msg: string;
    [key: string]: unknown;
}

const captureLogs = () => {
    const lines: string[] = [];
    return {
        lines,
        logging: {
            pretty: false,
            progress: false,
            level: "debug" as const,
            destination: {
                write: (line: string) => {
                    lines.push(line);
                },
            },
        },
        records: () => lines.map(line => JSON.parse(line) as LogRecord),
    };
};

test("records timed startup steps and preserves the original failure", async () => {
    const capture = captureLogs();
    const logs = new LogManager("Test", capture.logging);
    const result = await logs.step("Loading", "load", async () => 42);
    assert.equal(result, 42);
    const failure = new Error("Failed operation");
    await assert.rejects(
        logs.step("Deploying", "deploy", async () => {
            throw failure;
        }),
        error => error === failure,
    );
    const records = capture.records();
    assert.deepEqual(
        records.map(record => record.event),
        ["load.started", "load.completed", "deploy.started", "deploy.failed"],
    );
    assert.equal(typeof records[1]?.durationMs, "number");
    assert.equal(records[3]?.level, 50);
    assert.deepEqual(
        (records[3]?.err as { message: string } | undefined)?.message,
        failure.message,
    );
    assert.ok(capture.lines.every(line => !line.includes("\u001b")));
});

test("redacts credential fields and excludes arbitrary properties on errors", () => {
    const capture = captureLogs();
    const logs = new LogManager("Test", capture.logging);
    const err = Object.assign(
        new Error("Request failed", { cause: new Error("Underlying error") }),
        {
            token: "private-error-token",
            requestBody: { secret: "private-request-value" },
        },
    );
    logs.logger.error(
        {
            err,
            token: "private-root-token",
            options: { password: "private-password" },
        },
        "Failure",
    );
    const output = capture.lines.join("");
    for (const secret of [
        "private-error-token",
        "private-request-value",
        "private-root-token",
        "private-password",
    ]) {
        assert.ok(!output.includes(secret));
    }
    assert.ok(output.includes("[REDACTED]"));
    assert.ok(output.includes("Underlying error"));
    assert.ok(output.includes("stack"));
});

test("supports silent logging and a pretty output destination", async () => {
    const capture = captureLogs();
    const silent = new LogManager("Test", {
        ...capture.logging,
        level: "silent",
    });
    await silent.step("Silent", "silent", async () => undefined);
    assert.equal(capture.lines.length, 0);
    const prettyLogs = new LogManager("Test", {
        ...capture.logging,
        pretty: true,
    });
    prettyLogs.logger.info("Readable output");
    assert.ok(capture.lines.join("").includes("Readable output"));
    assert.ok(capture.lines.join("").includes("INFO"));
});

test("command context gets a correlated logger and completion timing", async t => {
    const capture = captureLogs();
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: capture.logging,
    });
    t.after(() => client.destroy());
    class LoggedCommand extends Command {
        constructor() {
            super({
                builder: new ChatInputCommandBuilder()
                    .setName("ping")
                    .setDescription("Ping"),
            });
        }
        public override async run(ctx: CommandContext): Promise<void> {
            ctx.logger.debug({ checkpoint: "ready" }, "Handler checkpoint");
            await ctx.interaction.reply("Pong!");
        }
    }
    client.commands.set("ping", new LoggedCommand());
    const interaction = {
        id: "execution-123",
        commandName: "ping",
        guildId: "guild-123",
        user: { id: "user-123" },
        isChatInputCommand: () => true,
        reply: async () => undefined,
    } as unknown as ChatInputCommandInteraction;
    await new InteractionDispatcher(client).dispatch(interaction);
    const records = capture.records();
    const checkpoint = records.find(record => record.checkpoint === "ready");
    const completed = records.find(
        record => record.event === "command.completed",
    );
    assert.equal(checkpoint?.interactionId, "execution-123");
    assert.equal(checkpoint?.command, "ping");
    assert.equal(checkpoint?.userId, "user-123");
    assert.equal(completed?.interactionId, "execution-123");
    assert.equal(typeof completed?.durationMs, "number");
    assert.equal(
        records.filter(record => record.event === "command.completed").length,
        1,
    );
});

test("errors stay visible at error level and users still receive error responses", async t => {
    const capture = captureLogs();
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: { ...capture.logging, level: "error" },
    });
    t.after(() => client.destroy());
    class BrokenCommand extends Command {
        constructor() {
            super({
                builder: new ChatInputCommandBuilder()
                    .setName("ping")
                    .setDescription("Ping"),
            });
        }
        public override async run(): Promise<void> {
            throw new Error("Handler failed");
        }
    }
    client.commands.set("ping", new BrokenCommand());
    let replies = 0;
    const interaction = {
        id: "failure-123",
        commandName: "ping",
        isChatInputCommand: () => true,
        reply: async () => {
            replies++;
        },
    } as unknown as ChatInputCommandInteraction;
    await new InteractionDispatcher(client).dispatch(interaction);
    assert.equal(replies, 1);
    assert.deepEqual(
        capture.records().map(record => record.event),
        ["command.failed"],
    );
});

test("initialization reports missing directories and skips deployment", async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyperion-logging-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const capture = captureLogs();
    const put = t.mock.method(REST.prototype, "put", async () => []);
    const client = await HyperionClient.create({
        name: "Test",
        root,
        discord: { intents: [] },
        logging: capture.logging,
        commands: { applicationId: "123", token: "test-token" },
    });
    t.after(() => client.destroy());
    const events = capture.records().map(record => record.event);
    assert.ok(events.includes("commands.directory.missing"));
    assert.ok(events.includes("commands.register.skipped"));
    assert.ok(events.includes("client.initialized"));
    assert.equal(put.mock.callCount(), 0);
    assert.ok(!capture.lines.join("").includes("test-token"));
});

test("login logs outcome without recording the token or returned credentials", async t => {
    const capture = captureLogs();
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: capture.logging,
    });
    t.after(() => client.destroy());
    t.mock.method(Client.prototype, "login", async () => "fake-returned-token");
    assert.equal(await client.login("fake-input-token"), "fake-returned-token");
    assert.ok(
        capture
            .records()
            .some(record => record.event === "client.login.completed"),
    );
    assert.ok(!capture.lines.join("").includes("fake-input-token"));
    assert.ok(!capture.lines.join("").includes("fake-returned-token"));
});
