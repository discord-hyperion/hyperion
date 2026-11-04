import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { pathToFileURL } from "node:url";
import { Client, Events } from "discord.js";
import {
    EventHandler,
    type EventRegistryOptions,
    HyperionClient,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const source = (label: string, body = "", options = "{}", async = true) => `
import { EventHandler } from ${JSON.stringify(library)};
export default class extends EventHandler {
    constructor() { super(${options}); }
    ${async ? "async " : ""}run(ctx) {
        ctx.client.emit("test:record", ${JSON.stringify(label)}, ctx);
        ${body}
    }
}`;

const deferred = () => {
    let resolve = () => {};
    const promise = new Promise<void>(done => {
        resolve = done;
    });

    return { promise, resolve };
};

const fixture = async (t: TestContext) => {
    const root = await createTempRoot(t, "hyperion-events-");
    const write = async (file: string, contents: string) => {
        const target = path.join(root, "src/events", file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents);
    };
    const create = async (events: EventRegistryOptions = {}) => {
        const records: string[] = [];

        const client = await HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            events,
            logging: {
                level: "debug",
                pretty: false,
                destination: { write: line => records.push(line) },
            },
        });

        t.after(() => client.destroy());
        const calls: string[] = [];
        client.on("test:record", (label: string) => {
            calls.push(label);
        });

        return { client, calls, records };
    };

    return { root, write, create };
};

test("discovers exact event folders recursively, sorts numeric priorities and ignores non-handlers", async t => {
    const { write, create } = await fixture(t);
    await write("debug/10-second.mjs", source("10"));
    await write("debug/2-first.mjs", source("2"));
    await write("debug/nested/30-third.mjs", source("30"));
    await write("debug/a-last.mjs", source("a"));
    await write("debug/z-last.mjs", source("z"));
    await write("warn/2-first.mjs", source("warn"));
    for (const filename of [
        "debug/index.mjs",
        "debug/x.test.mjs",
        "debug/x.spec.ts",
        "debug/types.d.ts",
        "debug/.hidden.mjs",
        "debug/node_modules/ignored.mjs",
    ]) {
        await write(filename, 'throw new Error("Must not import");');
    }
    const { client, calls } = await create();
    assert.equal(client.events.size, 6);
    client.emit(Events.Debug, "private text");
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["2", "10", "30", "a", "z"]);
});

test("an absent events directory is optional", async t => {
    const { create } = await fixture(t);
    const { client } = await create();
    assert.equal(client.events.size, 0);
});

for (const file of [
    "root.mjs",
    "client-ready/10-handler.mjs",
    "unknown/10-handler.mjs",
]) {
    test(`rejects an unrouteable event module: ${file}`, async t => {
        const { write, create } = await fixture(t);
        await write(file, source("unused"));

        await assert.rejects(
            create(),
            /folder named after a Discord client event/,
        );
    });
}

test("duplicate numeric priorities are scoped by event and preserve existing handlers on failure", async t => {
    const { root, write, create } = await fixture(t);
    await write("debug/2-first.mjs", source("old"));
    const { client, calls } = await create();
    await write("debug/nested/02-second.mjs", source("duplicate"));

    await assert.rejects(client.events.load(), error => {
        assert.match(String(error), /Duplicate priority 2/);
        assert.match(String(error), /2-first.mjs/);
        assert.match(String(error), /02-second.mjs/);

        return true;
    });

    assert.equal(client.events.size, 1);
    client.emit(Events.Debug, "private");
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["old"]);
    await rm(path.join(root, "src/events/debug/nested/02-second.mjs"));
    await write("warn/2-first.mjs", source("warn"));
    await client.events.load();
    assert.equal(client.events.size, 2);
});

for (const contents of [
    "export default {};",
    `import { EventHandler } from ${JSON.stringify(library)}; export default EventHandler;`,
    `import { EventHandler } from ${JSON.stringify(library)}; export default class extends EventHandler {}`,
    source("bad", "", '{once: "yes"}'),
    source("bad", "", "{once: true}").replace(
        "super({once: true});",
        'super({once: true}); this.once = "yes";',
    ),
    source("bad", "", "{}").replace(
        "super({});",
        'throw new Error("constructor failed");',
    ),
    "this is not valid JavaScript",
]) {
    test("invalid event definitions preserve active state and include their source and cause", async t => {
        const { write, create } = await fixture(t);
        await write("debug/10-handler.mjs", source("working"));
        const { client, calls } = await create();
        await write("debug/10-handler.mjs", contents);

        await assert.rejects(client.events.load(), error => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /10-handler.mjs/);
            assert.ok(error.cause);

            return true;
        });

        client.emit(Events.Debug, "private");
        await client.waitForAllListenersToComplete();
        assert.deepEqual(calls, ["working"]);
    });
}

test("awaits each handler and serializes occurrences, while another event progresses independently", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-start.mjs",
        source(
            "start",
            'if (ctx.args[0] === "first") await ctx.client.testGate();',
        ),
    );

    await write("debug/20-end.mjs", source("end"));
    await write("warn/10-independent.mjs", source("independent"));
    const { client, calls } = await create();
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    t.after(() => gate.resolve());
    try {
        client.emit(Events.Debug, "first");
        client.emit(Events.Debug, "second");
        client.emit(Events.Warn, "other");
        await Promise.resolve();
        assert.deepEqual(calls, ["start", "independent"]);
    } finally {
        gate.resolve();
    }
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["start", "independent", "end", "start", "end"]);
});

test("preserves zero and multiple SDK arguments with fresh invocation contexts", async t => {
    const { write, create } = await fixture(t);
    await write("invalidated/10-handler.mjs", source("empty"));
    await write("messageUpdate/10-handler.mjs", source("pair"));
    const { client } = await create();
    const contexts: unknown[] = [];
    const tuples: unknown[][] = [];
    client.on("test:record", (_label: string, ctx: { args: unknown[] }) => {
        contexts.push(ctx);
        tuples.push(ctx.args);
    });
    client.emit(Events.Invalidated);
    const oldMessage = { id: "old", partial: true };
    const newMessage = { id: "new", partial: false };
    // Deliberately partial objects; only the SDK event transport is exercised.
    Reflect.apply(client.emit, client, [
        Events.MessageUpdate,
        oldMessage,
        newMessage,
    ]);
    client.emit(Events.Invalidated);
    await client.waitForAllListenersToComplete();
    assert.deepEqual(tuples, [[], [oldMessage, newMessage], []]);
    assert.notEqual(contexts[0], contexts[2]);
});

test("contains sync and async failures, continues execution and excludes raw payloads from logs", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-sync.mjs",
        source(
            "sync",
            'throw Object.assign(new Error("expected failure"), { payload: ctx.args });',
            "{}",
            false,
        ),
    );

    await write(
        "debug/20-async.mjs",
        source(
            "async",
            'await Promise.resolve(); throw new Error("async failure");',
        ),
    );

    await write("debug/30-after.mjs", source("after"));
    const { client, calls, records } = await create();
    client.emit(Events.Debug, "sensitive-event-payload");
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["sync", "async", "after"]);
    const failures = records.filter(record =>
        record.includes('"event":"event.failed"'),
    );
    assert.equal(failures.length, 2);
    assert.ok(
        failures.every(
            record =>
                record.includes('"eventName":"debug"') &&
                record.includes('"source":'),
        ),
    );
    assert.ok(!records.join("").includes("sensitive-event-payload"));
    client.emit(Events.Debug, "again");
    await client.waitForAllListenersToComplete();
    assert.equal(calls.length, 6);
});

test("once is reserved at admission, remains consumed on failure and is reset by successful reload", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-gate.mjs",
        source(
            "gate",
            'if (ctx.args[0] === "first") await ctx.client.testGate();',
        ),
    );

    await write(
        "debug/20-once.mjs",
        source("once", 'throw new Error("expected");', "{once:true}"),
    );

    const { client, calls } = await create();
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    try {
        client.emit(Events.Debug, "first");
        client.emit(Events.Debug, "second");
    } finally {
        gate.resolve();
    }
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["gate", "once", "gate"]);
    await write("debug/20-once.mjs", "invalid syntax");
    await assert.rejects(client.events.load());
    client.emit(Events.Debug, "third");
    await client.waitForAllListenersToComplete();
    assert.equal(calls.filter(call => call === "once").length, 1);
    await write("debug/20-once.mjs", source("new-once", "", "{once:true}"));
    await client.events.load();
    client.emit(Events.Debug, "fourth");
    client.emit(Events.Debug, "fifth");
    await client.waitForAllListenersToComplete();
    assert.equal(calls.filter(call => call === "new-once").length, 1);
});

for (const capacity of [0, 1]) {
    test(`queue capacity ${capacity} excludes active work and discards only newest arrivals`, async t => {
        const { write, create } = await fixture(t);

        await write(
            "debug/10-handler.mjs",
            source("run", "await ctx.client.testGate();"),
        );

        const { client, calls, records } = await create({
            maxPendingPerEvent: capacity,
        });
        const gate = deferred();
        Object.assign(client, { testGate: () => gate.promise });
        try {
            client.emit(Events.Debug, "first");
            client.emit(Events.Debug, "second");
            client.emit(Events.Debug, "private-overflow");
            await Promise.resolve();
            assert.equal(calls.length, 1);
            assert.equal(
                records.filter(line =>
                    line.includes('"event":"event.queue.full"'),
                ).length,
                capacity === 0 ? 2 : 1,
            );
            assert.ok(!records.join("").includes("private-overflow"));
        } finally {
            gate.resolve();
        }
        await client.waitForAllListenersToComplete();
        assert.equal(calls.length, 1 + capacity);
    });
}

test("overflow does not consume a freshly reloaded one-shot handler", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-handler.mjs",
        source("old", "await ctx.client.testGate();"),
    );

    const { client, calls } = await create({ maxPendingPerEvent: 0 });
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    try {
        client.emit(Events.Debug, "first");

        await write(
            "debug/10-handler.mjs",
            source("new-once", "", "{once:true}"),
        );

        await client.events.load();
        client.emit(Events.Debug, "dropped");
    } finally {
        gate.resolve();
    }
    await client.waitForAllListenersToComplete();
    client.emit(Events.Debug, "accepted");
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["old", "new-once"]);
});

test("reload refreshes entry modules but accepted occurrences retain their complete original lists and FIFO", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-first.mjs",
        source(
            "old-first",
            'if (ctx.args[0] === "first") await ctx.client.testGate();',
        ),
    );

    await write("debug/20-last.mjs", source("old-last"));
    const { client, calls } = await create();
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    try {
        client.emit(Events.Debug, "first");
        client.emit(Events.Debug, "second");
        await write("debug/10-first.mjs", source("new-first"));
        await write("debug/20-last.mjs", source("new-last"));
        await client.events.load();
        client.emit(Events.Debug, "third");
        assert.deepEqual(calls, ["old-first"]);
        assert.equal(client.listenerCount(Events.Debug), 1);
    } finally {
        gate.resolve();
    }
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, [
        "old-first",
        "old-last",
        "old-first",
        "old-last",
        "new-first",
        "new-last",
    ]);
});

test("reload and shutdown preserve SDK/framework/application listeners and remove only owned ones", async t => {
    const { root, write, create } = await fixture(t);
    await write("debug/10-handler.mjs", source("debug"));
    await write("interactionCreate/10-handler.mjs", source("interaction"));
    const { client } = await create();
    const ready = client.listeners(Events.ClientReady)[0];
    const interaction = client.listeners(Events.InteractionCreate)[0];
    const app = () => {};
    client.on(Events.Debug, app);
    await client.events.load();
    assert.equal(client.listenerCount(Events.Debug), 2);
    assert.equal(client.listenerCount(Events.InteractionCreate), 2);
    await rm(path.join(root, "src/events"), { recursive: true });
    await client.events.load();
    assert.equal(client.events.size, 0);
    assert.deepEqual(client.listeners(Events.Debug), [app]);
    assert.deepEqual(client.listeners(Events.ClientReady), [ready]);
    assert.deepEqual(client.listeners(Events.InteractionCreate), [interaction]);
    await client.destroy();
    assert.deepEqual(client.listeners(Events.Debug), [app]);
});

test("shutdown drains active and queued work before SDK destruction and is idempotent", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-handler.mjs",
        source("run", "await ctx.client.testGate();"),
    );

    const { client, calls } = await create();
    const destroy = t.mock.method(Client.prototype, "destroy");
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    client.emit(Events.Debug, "first");
    client.emit(Events.Debug, "second");
    const closing = client.destroy();
    assert.equal(destroy.mock.callCount(), 0);
    assert.equal(client.listenerCount(Events.Debug), 0);
    client.emit(Events.Debug, "ignored");
    gate.resolve();
    await closing;
    assert.deepEqual(calls, ["run", "run"]);
    assert.equal(destroy.mock.callCount(), 1);
    await client.destroy();
    assert.equal(destroy.mock.callCount(), 1);
    await assert.rejects(client.events.load(), /shutdown/);
});

test("shutdown deadline discards waiting work and stops remaining handlers after active JavaScript finishes", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-handler.mjs",
        source("active", "await ctx.client.testGate();"),
    );

    await write("debug/20-later.mjs", source("later"));
    const { client, calls, records } = await create({ shutdownTimeoutMs: 0 });
    const gate = deferred();
    Object.assign(client, { testGate: () => gate.promise });
    try {
        client.emit(Events.Debug, "first");
        client.emit(Events.Debug, "second");
        await client.destroy();
        assert.deepEqual(calls, ["active"]);
        assert.ok(
            records.some(
                line =>
                    line.includes('"event":"events.shutdown.timeout"') &&
                    line.includes('"queueCount":1'),
            ),
        );
    } finally {
        gate.resolve();
    }
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["active"]);
});

test("initialization loads events only after other registries and cleans up failed initialization", async t => {
    const { write, create } = await fixture(t);
    await write("debug/10-handler.mjs", source("unused"));
    const { records } = await create();
    const steps = records.map(line => JSON.parse(line).event);
    assert.ok(
        steps.indexOf("modals.load.completed") <
            steps.indexOf("events.load.started"),
    );
    assert.ok(
        steps.indexOf("events.load.completed") <
            steps.indexOf("client.initialized"),
    );
    await write("debug/10-handler.mjs", "bad JavaScript");
    const destroy = t.mock.method(Client.prototype, "destroy");
    await assert.rejects(create(), /Failed to load event handler/);
    assert.equal(destroy.mock.callCount(), 1);
});

for (const events of [
    { maxPendingPerEvent: -1 },
    { maxPendingPerEvent: 0.5 },
    { maxPendingPerEvent: Infinity },
    { shutdownTimeoutMs: -1 },
    { shutdownTimeoutMs: 0.5 },
    { shutdownTimeoutMs: 2_147_483_648 },
]) {
    test("rejects invalid event queue options", async t => {
        const { create } = await fixture(t);
        await assert.rejects(create(events), /nonnegative/);
    });
}

test("destruction requested inside a handler still waits for its accepted work", async t => {
    const { write, create } = await fixture(t);

    await write(
        "debug/10-handler.mjs",
        source(
            "run",
            "ctx.client.startShutdown(); await ctx.client.testGate();",
        ),
    );

    const { client } = await create();
    const destroy = t.mock.method(Client.prototype, "destroy");
    const gate = deferred();
    let closing = Promise.resolve();
    Object.assign(client, {
        testGate: () => gate.promise,
        startShutdown: () => {
            closing = client.destroy();
        },
    });
    try {
        client.emit(Events.Debug, "first");
        for (let turn = 0; turn < 8; turn++) {
            await Promise.resolve();
        }
        assert.equal(destroy.mock.callCount(), 0);
    } finally {
        gate.resolve();
    }
    await closing;
    assert.equal(destroy.mock.callCount(), 1);
});

test("reload refreshes CommonJS entry modules without replacing shared framework constructors", async t => {
    const { root, write, create } = await fixture(t);
    // Supply the same ESM constructor through a CJS bridge. This isolates Node's
    // entry cache from tsx's distinct source require/import compilation graphs.
    const bridge = path.join(root, "shared.cjs");
    await writeFile(bridge, "module.exports = {};");
    const require = createRequire(import.meta.url);
    require(bridge).EventHandler = EventHandler;
    const commonjs = (label: string) =>
        source(label)
            .replace(
                `import { EventHandler } from ${JSON.stringify(library)};`,
                `const { EventHandler } = require(${JSON.stringify(bridge)});`,
            )
            .replace("export default class", "module.exports = class");
    await write("debug/10-handler.cjs", commonjs("old"));
    const { client, calls } = await create();
    client.emit(Events.Debug, "first");
    await client.waitForAllListenersToComplete();
    await write("debug/10-handler.cjs", commonjs("new"));
    await client.events.load();
    client.emit(Events.Debug, "second");
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["old", "new"]);
});

test("client error handlers contain their own failures without recursive error emission", async t => {
    const { write, create } = await fixture(t);

    await write(
        "error/10-handler.mjs",
        source("error", 'throw new Error("handler failed");'),
    );

    await write("error/20-after.mjs", source("after"));
    const { client, calls, records } = await create();
    client.emit(Events.Error, new Error("private-event-error"));
    await client.waitForAllListenersToComplete();
    assert.deepEqual(calls, ["error", "after"]);
    assert.equal(
        records.filter(line => line.includes('"event":"event.failed"')).length,
        1,
    );
    assert.ok(!records.join("").includes("private-event-error"));
});

test("rejects priorities outside the safe integer range", async t => {
    const { write, create } = await fixture(t);
    await write("debug/9007199254740992-handler.mjs", source("invalid"));
    await assert.rejects(create(), /safe nonnegative integer/);
});

test("a load finishing after shutdown cannot reattach event listeners", async t => {
    const { root, write, create } = await fixture(t);
    await write("debug/10-handler.mjs", source("old"));
    const { client } = await create();
    const stageFile = path.join(root, "stage.mjs");

    await writeFile(
        stageFile,
        `
        export let release;
        export let started;
        export const gate = new Promise(resolve => { release = resolve; });
        export const entered = new Promise(resolve => { started = resolve; });
    `,
    );

    const stageUrl = pathToFileURL(stageFile).href;
    const stage = await import(stageUrl);

    await write(
        "debug/10-handler.mjs",
        `import { gate, started } from ${JSON.stringify(stageUrl)}; started(); await gate; ${source("new")}`,
    );

    const loading = client.events.load();
    try {
        await stage.entered;
        await client.destroy();
    } finally {
        stage.release();
    }
    await assert.rejects(loading, /shutdown/);
    assert.equal(client.events.size, 0);
    assert.equal(client.listenerCount(Events.Debug), 0);
});
