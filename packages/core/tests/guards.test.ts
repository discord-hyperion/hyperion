import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { createChatInputInteraction } from "../../../tests/fixtures/interactions.ts";
import { type CommandContext, defineCommand } from "../src/commands/index.ts";
import {
    defineGuard,
    type Guard,
    type GuardProvider,
    ownerOnly,
} from "../src/guards/index.ts";
import { createTestClient } from "./support/test-client.ts";

const check = (execute: (ctx: CommandContext) => boolean | Promise<boolean>) =>
    defineGuard({
        name: "test-check",
        description: "Access denied.",
        run(ctx: CommandContext) {
            return execute(ctx);
        },
    });

const guardedCommand = (
    guards: readonly GuardProvider[],
    execute = async (_ctx: CommandContext) => {},
) =>
    defineCommand({
        builder: new ChatInputCommandBuilder()
            .setName("test")
            .setDescription("Test"),
        guards,
        run: execute,
    });

const setup = async (t: TestContext) => {
    const result = await createTestClient(t);
    t.mock.method(result.client, "getOwnerId", async () => "owner");

    return result;
};
const interaction = (
    phase: "new" | "deferred" | "replied" = "new",
    userId = "owner",
) =>
    createChatInputInteraction({
        id: userId,
        commandName: "test",
        user: { id: userId },
        deferred: phase === "deferred",
        replied: phase === "replied",
    });

test("shared guards and lazy async factories run in order with the handler's context", async t => {
    const { client, dispatcher, records } = await setup(t);
    const order: string[] = [];
    let checked: CommandContext | undefined;
    const factory = mock.fn(async (ctx: CommandContext) => {
        order.push("factory");

        return check(next => {
            assert.equal(next, ctx);
            checked = next;
            order.push("second");

            return true;
        });
    });
    client.commands.set(
        "test",
        guardedCommand(
            [
                check(() => {
                    order.push("first");

                    return true;
                }),
                factory,
            ],
            async ctx => {
                assert.equal(ctx, checked);
                order.push("handler");
            },
        ),
    );
    assert.equal(factory.mock.callCount(), 0);
    await dispatcher.dispatch(interaction().interaction);
    assert.deepEqual(order, ["first", "factory", "second", "handler"]);
    assert.equal(
        records.filter(record => record.event === "guard.passed").length,
        2,
    );
    assert.ok(records.some(record => record.event === "command.completed"));
});

for (const phase of ["new", "deferred", "replied"] as const) {
    test(`rejection stops later factories and responds in the ${phase} state`, async t => {
        const { client, dispatcher, records } = await setup(t);
        const later = mock.fn(() => check(() => true));
        const execute = mock.fn(async (_ctx: CommandContext) => {});
        client.commands.set(
            "test",
            guardedCommand([check(() => false), later], execute),
        );
        const fixture = interaction(phase);
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(later.mock.callCount(), 0);
        assert.equal(execute.mock.callCount(), 0);
        assert.equal(fixture.reply.mock.callCount(), phase === "new" ? 1 : 0);
        assert.equal(
            fixture.editReply.mock.callCount(),
            phase === "deferred" ? 1 : 0,
        );
        assert.equal(
            fixture.followUp.mock.callCount(),
            phase === "replied" ? 1 : 0,
        );
        const response =
            phase === "new"
                ? fixture.reply
                : phase === "deferred"
                  ? fixture.editReply
                  : fixture.followUp;
        assert.deepEqual(response.mock.calls[0]?.arguments[0], {
            content: "Access denied.",
            ...(phase === "deferred" ? {} : { flags: MessageFlags.Ephemeral }),
        });
        const rejection = records.find(
            record => record.event === "guard.rejected",
        );
        assert.equal(rejection?.interactionId, "owner");
        assert.equal(rejection?.guard, "test-check");
        assert.equal(typeof rejection?.durationMs, "number");
        assert.ok(records.some(record => record.event === "command.rejected"));
        assert.ok(
            !records.some(record => record.event === "command.completed"),
        );
    });
}

test("custom onFail preserves its receiver and owns the response", async t => {
    const { client, dispatcher } = await setup(t);
    let failed = 0;
    const customCheck = (execute: () => boolean) =>
        defineGuard({
            name: "test-check",
            description: "Access denied.",
            run: execute,
            async onFail(ctx: CommandContext) {
                assert.equal(this.name, "test-check");
                failed++;
                await ctx.interaction.reply("Custom rejection");
            },
        });
    client.commands.set("test", guardedCommand([customCheck(() => false)]));
    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(failed, 1);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Custom rejection");
    client.commands.set("test", guardedCommand([customCheck(() => true)]));
    await dispatcher.dispatch(interaction().interaction);
    assert.equal(failed, 1);
});

test("factories create independent instances for concurrent invocations", async t => {
    const { client, dispatcher } = await setup(t);
    const instances: Guard[] = [];
    const users: string[] = [];
    client.commands.set(
        "test",
        guardedCommand([
            ctx => {
                const expected = ctx.interaction.user.id;
                const guard = check(async next => {
                    await Promise.resolve();
                    assert.equal(next.interaction.user.id, expected);
                    users.push(expected);

                    return true;
                });
                instances.push(guard);

                return guard;
            },
        ]),
    );

    await Promise.all([
        dispatcher.dispatch(interaction("new", "first").interaction),
        dispatcher.dispatch(interaction("new", "second").interaction),
    ]);

    assert.deepEqual(users.sort(), ["first", "second"]);
    assert.equal(instances.length, 2);
    assert.notEqual(instances[0], instances[1]);
});

const brokenProviders: Record<string, GuardProvider> = {
    "throwing check": check(() => {
        throw new Error("Check failed");
    }),
    "rejected check": check(async () => {
        throw new Error("Check failed");
    }),
    "throwing factory": () => {
        throw new Error("Factory failed");
    },
    "rejected factory": async () => {
        throw new Error("Factory failed");
    },
    "invalid factory result": (() => ({})) as unknown as GuardProvider,
    "nonboolean check result": check(
        (() => undefined) as unknown as () => boolean,
    ),
};
for (const [name, provider] of Object.entries(brokenProviders)) {
    test(`${name} fails closed and uses the generic error response`, async t => {
        const { client, dispatcher, records } = await setup(t);
        const execute = mock.fn(async (_ctx: CommandContext) => {});
        client.commands.set("test", guardedCommand([provider], execute));
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(execute.mock.callCount(), 0);
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content: "Something went wrong while running this command.",
            flags: MessageFlags.Ephemeral,
        });
        assert.equal(
            records.find(record => record.event === "command.failed")?.stage,
            "guards",
        );
    });
}

test("onFail errors and response delivery errors cannot reach the command", async t => {
    const { client, dispatcher, records } = await setup(t);
    const guard = defineGuard({
        name: "test-check",
        description: "Access denied.",
        run: () => false,
        onFail: async () => {
            throw new Error("Custom response failed");
        },
    });
    const execute = mock.fn(async (_ctx: CommandContext) => {});
    client.commands.set("test", guardedCommand([guard], execute));
    const fixture = interaction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(execute.mock.callCount(), 0);
    assert.ok(records.some(record => record.event === "command.failed"));
    assert.ok(
        records.some(
            record => record.event === "command.error-response.failed",
        ),
    );
});

test("rejects malformed shared guards and snapshots the provider list", () => {
    assert.throws(
        () => guardedCommand([{} as Guard]),
        /guards from defineGuard\(\)/,
    );
    const providers: GuardProvider[] = [ownerOnly];
    const command = guardedCommand(providers);
    providers.length = 0;
    assert.equal(command.guards.length, 1);
    assert.ok(Object.isFrozen(command.guards));
});

test("ownerOnly allows the API owner and denies others or failed lookups", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: CommandContext) => {});
    client.commands.set("test", guardedCommand([ownerOnly], execute));
    await dispatcher.dispatch(interaction().interaction);
    await dispatcher.dispatch(interaction("new", "other").interaction);
    assert.equal(execute.mock.callCount(), 1);
    const empty = await setup(t);
    t.mock.method(empty.client, "getOwnerId", async () => {
        throw new Error("Ownership lookup failed");
    });
    empty.client.commands.set("test", guardedCommand([ownerOnly], execute));
    await empty.dispatcher.dispatch(interaction().interaction);
    assert.equal(execute.mock.callCount(), 1);
});

test("defineGuard validates its definition and returns a frozen guard", () => {
    const guard = defineGuard({
        name: "always",
        description: "Never denied.",
        run: () => true,
    });

    assert.ok(Object.isFrozen(guard));
    assert.equal(guard.name, "always");
    assert.equal(guard.onFail, undefined);

    for (const [definition, message] of [
        [{ description: "x", run: () => true }, /non-empty name/],
        [{ name: "", description: "x", run: () => true }, /non-empty name/],
        [{ name: "a", run: () => true }, /requires a description/],
        [{ name: "a", description: "x" }, /requires a run\(\) function/],
        [
            { name: "a", description: "x", run: () => true, onFail: "no" },
            /onFail must be a function/,
        ],
    ] as const) {
        assert.throws(
            () => defineGuard(definition as unknown as Guard),
            message,
        );
    }
});

test("closure guards keep state across invocations", async t => {
    const { client, dispatcher } = await setup(t);
    const rateLimit = (max: number) => {
        const counts = new Map<string, number>();

        return defineGuard({
            name: "rate-limit",
            description: "You are doing that too often.",
            run: (ctx: CommandContext) => {
                const used = counts.get(ctx.interaction.user.id) ?? 0;
                counts.set(ctx.interaction.user.id, used + 1);

                return used < max;
            },
        });
    };
    const execute = mock.fn(async (_ctx: CommandContext) => {});
    client.commands.set("test", guardedCommand([rateLimit(2)], execute));

    for (let i = 0; i < 3; i++) {
        await dispatcher.dispatch(interaction().interaction);
    }

    assert.equal(execute.mock.callCount(), 2);
});
