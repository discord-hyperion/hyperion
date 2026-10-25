import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { Command, type CommandContext } from "../src/commands/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider, OwnerOnly } from "../src/guards/index.ts";

class Check extends Guard {
    constructor(
        private readonly execute: (
            ctx: CommandContext,
        ) => boolean | Promise<boolean>,
    ) {
        super({ name: "test-check", description: "Access denied." });
    }

    run(ctx: CommandContext) {
        return this.execute(ctx);
    }
}

class GuardedCommand extends Command {
    constructor(
        guards: readonly GuardProvider[],
        private readonly execute = async (_ctx: CommandContext) => {},
    ) {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("test")
                .setDescription("Test"),
            guards,
        });
    }

    run(ctx: CommandContext) {
        return this.execute(ctx);
    }
}

const setup = async (t: TestContext) => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level: "debug",
            pretty: false,
            progress: false,
            destination: {
                write: line => {
                    records.push(JSON.parse(line));
                },
            },
        },
    });
    t.after(() => client.destroy());
    t.mock.method(client, "getOwnerId", async () => "owner");
    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

const interaction = (
    phase: "new" | "deferred" | "replied" = "new",
    userId = "owner",
) => {
    const reply = mock.fn(async (_options: unknown) => undefined);
    const editReply = mock.fn(async (_options: unknown) => undefined);
    const followUp = mock.fn(async (_options: unknown) => undefined);
    const value = {
        id: userId,
        commandName: "test",
        user: { id: userId },
        deferred: phase === "deferred",
        replied: phase === "replied",
        isChatInputCommand: () => true,
        reply,
        editReply,
        followUp,
    } as unknown as ChatInputCommandInteraction;
    return { value, reply, editReply, followUp };
};

test("shared guards and lazy async factories run in order with the handler's context", async t => {
    const { client, dispatcher, records } = await setup(t);
    const order: string[] = [];
    let checked: CommandContext | undefined;
    const factory = mock.fn(async (ctx: CommandContext) => {
        order.push("factory");
        return new Check(next => {
            assert.equal(next, ctx);
            checked = next;
            order.push("second");
            return true;
        });
    });
    client.commands.set(
        "test",
        new GuardedCommand(
            [
                new Check(() => {
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
    await dispatcher.dispatch(interaction().value);
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
        const later = mock.fn(() => new Check(() => true));
        const execute = mock.fn(async (_ctx: CommandContext) => {});
        client.commands.set(
            "test",
            new GuardedCommand([new Check(() => false), later], execute),
        );
        const fixture = interaction(phase);
        await dispatcher.dispatch(fixture.value);
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
    class CustomCheck extends Check {
        async onFail(ctx: CommandContext) {
            assert.equal(this.name, "test-check");
            failed++;
            await ctx.interaction.reply("Custom rejection");
        }
    }
    client.commands.set(
        "test",
        new GuardedCommand([new CustomCheck(() => false)]),
    );
    const fixture = interaction();
    await dispatcher.dispatch(fixture.value);
    assert.equal(failed, 1);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Custom rejection");
    client.commands.set(
        "test",
        new GuardedCommand([new CustomCheck(() => true)]),
    );
    await dispatcher.dispatch(interaction().value);
    assert.equal(failed, 1);
});

test("factories create independent instances for concurrent invocations", async t => {
    const { client, dispatcher } = await setup(t);
    const instances: Check[] = [];
    const users: string[] = [];
    client.commands.set(
        "test",
        new GuardedCommand([
            ctx => {
                const expected = ctx.interaction.user.id;
                const guard = new Check(async next => {
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
        dispatcher.dispatch(interaction("new", "first").value),
        dispatcher.dispatch(interaction("new", "second").value),
    ]);
    assert.deepEqual(users.sort(), ["first", "second"]);
    assert.equal(instances.length, 2);
    assert.notEqual(instances[0], instances[1]);
});

const brokenProviders: Record<string, GuardProvider> = {
    "throwing check": new Check(() => {
        throw new Error("Check failed");
    }),
    "rejected check": new Check(async () => {
        throw new Error("Check failed");
    }),
    "throwing factory": () => {
        throw new Error("Factory failed");
    },
    "rejected factory": async () => {
        throw new Error("Factory failed");
    },
    "invalid factory result": (() => ({})) as unknown as GuardProvider,
    "nonboolean check result": new Check(
        (() => undefined) as unknown as () => boolean,
    ),
};
for (const [name, provider] of Object.entries(brokenProviders)) {
    test(`${name} fails closed and uses the generic error response`, async t => {
        const { client, dispatcher, records } = await setup(t);
        const execute = mock.fn(async (_ctx: CommandContext) => {});
        client.commands.set("test", new GuardedCommand([provider], execute));
        const fixture = interaction();
        await dispatcher.dispatch(fixture.value);
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
    const guard = new Check(() => false);
    guard.onFail = async () => {
        throw new Error("Custom response failed");
    };
    const execute = mock.fn(async (_ctx: CommandContext) => {});
    client.commands.set("test", new GuardedCommand([guard], execute));
    const fixture = interaction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    await dispatcher.dispatch(fixture.value);
    assert.equal(execute.mock.callCount(), 0);
    assert.ok(records.some(record => record.event === "command.failed"));
    assert.ok(
        records.some(
            record => record.event === "command.error-response.failed",
        ),
    );
});

test("rejects malformed shared guards and snapshots the provider list", () => {
    assert.throws(() => new GuardedCommand([{} as Guard]), /Guard instances/);
    const providers: GuardProvider[] = [new OwnerOnly()];
    const command = new GuardedCommand(providers);
    providers.length = 0;
    assert.equal(command.guards.length, 1);
    assert.ok(Object.isFrozen(command.guards));
});

test("OwnerOnly allows the API owner and denies others or failed lookups", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: CommandContext) => {});
    client.commands.set("test", new GuardedCommand([new OwnerOnly()], execute));
    await dispatcher.dispatch(interaction().value);
    await dispatcher.dispatch(interaction("new", "other").value);
    assert.equal(execute.mock.callCount(), 1);
    const empty = await setup(t);
    t.mock.method(empty.client, "getOwnerId", async () => {
        throw new Error("Ownership lookup failed");
    });
    empty.client.commands.set(
        "test",
        new GuardedCommand([new OwnerOnly()], execute),
    );
    await empty.dispatcher.dispatch(interaction().value);
    assert.equal(execute.mock.callCount(), 1);
});
