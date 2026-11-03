import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, mock, test } from "node:test";
import { PrimaryButtonBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import * as v from "valibot";
import { createButtonInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    type ButtonContext,
    ButtonHandler,
    defineParams,
} from "../src/components/index.ts";
import { defineGuard } from "../src/guards/index.ts";
import { ButtonRegistry } from "../src/registries/index.ts";
import { buttonKind } from "./support/component-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";
import { createTestClient } from "./support/test-client.ts";

const todoDone = defineParams({
    id: "todo.done",
    keys: ["owner", "page", "todoId"],
    schema: v.object({
        owner: v.string(),
        page: v.pipe(v.string(), v.toNumber()),
        todoId: v.string(),
    }),
});

type TodoContext = ButtonContext<typeof todoDone>;

class TodoButton extends ButtonHandler<typeof todoDone> {
    constructor(
        private readonly execute: (ctx: TodoContext) => Promise<void>,
        guards: ButtonHandler<typeof todoDone>["guards"] = [],
    ) {
        super({ params: todoDone, guards });
    }

    run(ctx: TodoContext) {
        return this.execute(ctx);
    }
}

const click = (customId: string, userId = "owner") =>
    createButtonInteraction({ id: "click", customId, user: { id: userId } });

describe("defineParams", () => {
    test("encodes values in key order and round-trips escaped characters", () => {
        assert.equal(
            todoDone({ owner: "1", page: 2, todoId: "abc" }),
            "todo.done:1:2:abc",
        );

        const registry = new ButtonRegistry();
        registry.routes.set(
            todoDone.id,
            new TodoButton(async () => {}) as never,
        );
        const encoded = todoDone({ owner: "a:b", page: 1, todoId: "100%" });

        assert.equal(encoded, "todo.done:a%3Ab:1:100%25");
        assert.deepEqual(registry.resolve(encoded)?.raw, {
            owner: "a:b",
            page: "1",
            todoId: "100%",
        });
    });

    test("rejects values that cannot be carried", () => {
        for (const bad of [undefined, null, {}, Number.NaN, Infinity]) {
            assert.throws(
                () => todoDone({ owner: "1", page: 1, todoId: bad as string }),
                /todoId.*string, finite number, or boolean/,
            );
        }
        assert.throws(
            () => todoDone({ owner: "x".repeat(100), page: 1, todoId: "a" }),
            /exceeds 100 characters/,
        );
        assert.equal(
            todoDone({ owner: "x".repeat(60), page: 1, todoId: "a" }).length,
            "todo.done:".length + 60 + ":1:a".length,
        );
    });

    test("validates its definition and freezes the result", () => {
        const schema = v.object({});
        const invalid: [string, unknown][] = [
            ["id", { id: "", keys: [], schema }],
            ["id", { id: "a:b", keys: [], schema }],
            ["id", { id: "a%b", keys: [], schema }],
            ["keys", { id: "a", keys: ["k", "k"], schema }],
            ["keys", { id: "a", keys: [""], schema }],
            ["schema", { id: "a", keys: [], schema: {} }],
        ];
        for (const [field, definition] of invalid) {
            assert.throws(
                () =>
                    defineParams(
                        definition as Parameters<typeof defineParams>[0],
                    ),
                new RegExp(`Params ${field}`),
            );
        }
        assert.ok(Object.isFrozen(todoDone));
    });
});

describe("button params routing", () => {
    test("unmatched, malformed, and literal IDs never resolve to a params handler", () => {
        const registry = new ButtonRegistry();
        registry.routes.set(
            todoDone.id,
            new TodoButton(async () => {}) as never,
        );

        for (const customId of [
            "todo.done",
            "todo.done:1:2",
            "todo.done:1:2:3:4",
            "todo.done:1:2:%zz",
            "todo.done:1:2:%3a",
            "todo.done2:1:2:3",
            "other:1:2:3",
        ]) {
            assert.equal(registry.resolve(customId), undefined, customId);
        }
    });

    test("exact literal IDs win and keep their own routing", () => {
        const registry = new ButtonRegistry();
        const literal = new (class extends ButtonHandler {
            constructor() {
                super({
                    customId: "todo.done:1:2:3",
                    builder: new PrimaryButtonBuilder()
                        .setCustomId("todo.done:1:2:3")
                        .setLabel("Literal"),
                });
            }
            async run() {}
        })();
        registry.set(literal.customId, literal);
        registry.routes.set(
            todoDone.id,
            new TodoButton(async () => {}) as never,
        );

        assert.equal(registry.resolve("todo.done:1:2:3")?.button, literal);
        assert.equal(registry.resolve("todo.done:1:2:3")?.raw, undefined);
    });
});

describe("button params loading", () => {
    const paramsSource = (route: string) => `
        import { ButtonHandler, defineParams } from ${JSON.stringify(new URL("../src/components/index.ts", import.meta.url).href)};
        const params = defineParams({ id: ${JSON.stringify(route)}, keys: [], schema: { "~standard": { version: 1, vendor: "test", validate: v => ({ value: v }) } } });
        export default class extends ButtonHandler {
            constructor() { super({ params }); }
            async run() {}
        }
    `;

    test("discovers params handlers by route and keeps them out of the literal collection", async t => {
        const { root, directory } = await createHandlerRoot(
            t,
            "hyperion-params-",
            "buttons",
        );
        await writeFile(path.join(directory, "a.mjs"), paramsSource("a.route"));
        await writeFile(
            path.join(directory, "b.mjs"),
            buttonKind.source("b.literal"),
        );
        const registry = new ButtonRegistry();
        await registry.load(root);

        assert.deepEqual([...registry.keys()], ["b.literal"]);
        assert.deepEqual([...registry.routes.keys()], ["a.route"]);
        assert.equal(
            registry.resolve("a.route")?.button,
            registry.routes.get("a.route"),
        );
    });

    test("failures preserve previously loaded handlers", async t => {
        const { root, directory } = await createHandlerRoot(
            t,
            "hyperion-params-",
            "buttons",
        );
        const registry = new ButtonRegistry();
        await writeFile(path.join(directory, "a.mjs"), paramsSource("a.route"));
        await registry.load(root);
        const original = registry.routes.get("a.route");

        const cases: [string, string, RegExp][] = [
            [
                "route",
                paramsSource("a.route"),
                /Duplicate button route "a\.route".*route\.mjs/,
            ],
            [
                "literal",
                buttonKind.source("a.route"),
                /route "a\.route" collides with a literal custom ID/,
            ],
        ];
        // Module URLs are cached, so every case gets its own file.
        for (const [name, source, error] of cases) {
            const file = path.join(directory, `${name}.mjs`);
            await writeFile(file, source);

            await assert.rejects(registry.load(root), error);
            assert.equal(registry.routes.get("a.route"), original);

            await rm(file);
        }
    });

    test("a handler cannot declare both a customId and params", () => {
        assert.throws(
            () =>
                new (class extends ButtonHandler<typeof todoDone> {
                    constructor() {
                        super({ params: todoDone, customId: "x" } as never);
                    }
                    async run() {}
                })(),
            /either a customId or params/,
        );
    });
});

describe("button params dispatch", () => {
    test("guards and the handler receive validated, typed params", async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const seesParams = () =>
            defineGuard<TodoContext>({
                name: "SeesParams",
                description: "Denied",
                run(ctx: TodoContext) {
                    seen.push(ctx.params);
                    return ctx.params[1]?.owner === ctx.interaction.user.id;
                },
            });
        const seen: TodoContext["params"][] = [];
        const execute = mock.fn(async (ctx: TodoContext) => {
            const [issues, value] = ctx.params;
            assert.equal(issues, null);
            assert.deepEqual(value, { owner: "owner", page: 2, todoId: "a:b" });
            await ctx.interaction.reply("ok");
        });
        client.buttons.routes.set(
            todoDone.id,
            new TodoButton(execute, [seesParams()]) as never,
        );
        const id = todoDone({ owner: "owner", page: 2, todoId: "a:b" });

        const owner = click(id);
        await dispatcher.dispatch(owner.interaction);
        const other = click(id, "intruder");
        await dispatcher.dispatch(other.interaction);

        assert.equal(execute.mock.callCount(), 1);
        assert.equal(seen.length, 2);
        assert.deepEqual(other.reply.mock.calls[0]?.arguments[0], {
            content: "Denied",
            flags: MessageFlags.Ephemeral,
        });
        assert.ok(!JSON.stringify(records).includes("a:b"));
        assert.ok(!JSON.stringify(records).includes("intruder-secret"));
        assert.equal(
            records.find(record => record.event === "button.completed")?.button,
            "todo.done",
        );
    });

    test("schema failures reach guards and the handler as issues", async t => {
        const { client, dispatcher } = await createTestClient(t);
        const execute = mock.fn(async (ctx: TodoContext) => {
            const [issues, value] = ctx.params;
            assert.ok(issues && issues.length > 0);
            assert.equal(value, undefined);
            await ctx.interaction.reply("out of date");
        });
        const guard = mock.fn((ctx: TodoContext) => ctx.params[0] === null);
        const issueGuard = () =>
            defineGuard<TodoContext>({
                name: "IssueGuard",
                description: "Invalid params",
                run(ctx: TodoContext) {
                    return guard(ctx);
                },
                async onFail(ctx: TodoContext) {
                    await ctx.interaction.reply("rejected");
                },
            });
        client.buttons.routes.set(
            todoDone.id,
            new TodoButton(execute, [issueGuard()]) as never,
        );

        const bad = click("todo.done:owner:not-a-number:abc");
        await dispatcher.dispatch(bad.interaction);

        assert.equal(guard.mock.callCount(), 1);
        assert.equal(execute.mock.callCount(), 0);
        assert.equal(bad.reply.mock.calls[0]?.arguments[0], "rejected");

        // Without the guard the handler decides the response.
        client.buttons.routes.set(
            todoDone.id,
            new TodoButton(execute) as never,
        );
        const handled = click("todo.done:owner:not-a-number:abc");
        await dispatcher.dispatch(handled.interaction);

        assert.equal(execute.mock.callCount(), 1);
        assert.equal(handled.reply.mock.calls[0]?.arguments[0], "out of date");
    });

    test("unmatched and undecodable IDs are ignored without a reply", async t => {
        const { client, dispatcher } = await createTestClient(t);
        const execute = mock.fn(async () => {});
        client.buttons.routes.set(
            todoDone.id,
            new TodoButton(execute) as never,
        );

        for (const customId of ["todo.done:1:2", "elsewhere:1:2:3"]) {
            const fixture = click(customId);
            await dispatcher.dispatch(fixture.interaction);

            assert.equal(fixture.reply.mock.callCount(), 0);
        }
        assert.equal(execute.mock.callCount(), 0);
    });

    test("schema exceptions fail in the params stage with a private reply", async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const boom = defineParams({
            id: "boom",
            keys: [],
            schema: {
                "~standard": {
                    version: 1,
                    vendor: "test",
                    validate: () => {
                        throw new Error("Private schema failure");
                    },
                },
            },
        });
        const execute = mock.fn(async () => {});
        client.buttons.routes.set(
            "boom",
            new (class extends ButtonHandler<typeof boom> {
                constructor() {
                    super({ params: boom });
                }
                run() {
                    return execute();
                }
            })() as never,
        );
        const fixture = click("boom");
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(execute.mock.callCount(), 0);
        assert.equal(
            records.find(record => record.event === "button.failed")?.stage,
            "params",
        );
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content: "Something went wrong while running this button.",
            flags: MessageFlags.Ephemeral,
        });
    });
});
