import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { pino } from "pino";
import { loadEventHandlers } from "../src/events/load-event-handlers.ts";
import {
    ButtonRegistry,
    defineButton,
    defineEvent,
    defineGuard,
    type InteractionContext,
} from "../src/index.ts";
import { createHandlerRoot, createTempRoot } from "./support/temp-root.ts";

const library = new URL("../src/index.ts", import.meta.url).href;
const builders = import.meta.resolve("@discordjs/builders");

test("define functions check their options and freeze the handler", () => {
    const run = () => {};
    const button = defineButton({
        builder: new PrimaryButtonBuilder()
            .setCustomId("profile.refresh")
            .setLabel("Refresh"),
        run,
    });

    assert.equal(button.customId, "profile.refresh");
    assert.ok(Object.isFrozen(button));
    assert.ok(Object.isFrozen(button.guards));

    assert.throws(
        () => defineButton({ customId: "x" } as never),
        /must provide a run\(\) function/,
    );
    assert.throws(
        () =>
            defineButton({
                customId: "x",
                guards: [{ name: "fake", run: () => true } as never],
                run,
            }),
        /guards must be guards from defineGuard\(\)/,
    );
    assert.throws(() => defineEvent({ run } as never), /must name their event/);
});

test("a defined handler's run is the function it was given", async () => {
    const calls: unknown[] = [];
    const guard = defineGuard<InteractionContext>({
        name: "always",
        description: "Always.",
        run: () => true,
    });
    const button = defineButton({
        customId: "record",
        guards: [guard],
        run: ctx => {
            calls.push(ctx);
        },
    });
    const ctx = {} as Parameters<typeof button.run>[0];

    await button.run(ctx);

    assert.deepEqual(calls, [ctx]);
    assert.deepEqual(button.guards, [guard]);
});

test("the loader takes a defined handler and names the define function otherwise", async t => {
    const { root, directory } = await createHandlerRoot(
        t,
        "hyperion-define-",
        "buttons",
    );

    await writeFile(
        path.join(directory, "refresh.mjs"),
        `import { defineButton } from ${JSON.stringify(library)};
        import { PrimaryButtonBuilder } from ${JSON.stringify(builders)};
        export default defineButton({
            builder: new PrimaryButtonBuilder().setCustomId("profile.refresh").setLabel("Refresh"),
            run() {},
        });`,
    );

    const registry = new ButtonRegistry();
    await registry.load(root);

    assert.equal(registry.get("profile.refresh")?.customId, "profile.refresh");

    await writeFile(
        path.join(directory, "plain.mjs"),
        'export default { customId: "plain", run() {} };',
    );

    await assert.rejects(registry.load(root), error => {
        assert.ok(error instanceof Error);
        assert.match(
            error.message,
            /Failed to load button from ".*plain\.mjs"/,
        );
        assert.ok(error.cause instanceof TypeError);
        assert.equal(
            error.cause.message,
            "Expected a default export from defineButton().",
        );

        return true;
    });
});

test("an event handler must be in the folder of the event it names", async t => {
    const root = await createTempRoot(t, "hyperion-define-event-");
    const directory = path.join(root, "src", "events", "messageCreate");
    await mkdir(directory, { recursive: true });

    await writeFile(
        path.join(directory, "ready.mjs"),
        `import { defineEvent } from ${JSON.stringify(library)};
        export default defineEvent({ event: "clientReady", run() {} });`,
    );

    await assert.rejects(
        loadEventHandlers(root, pino({ level: "silent" })),
        error => {
            assert.ok(error instanceof Error);
            assert.ok(error.cause instanceof TypeError);
            assert.equal(
                error.cause.message,
                'Event handler is for "clientReady" but is in the "messageCreate" folder.',
            );

            return true;
        },
    );
});
