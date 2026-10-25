import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { UserSelectMenuBuilder } from "@discordjs/builders";
import {
    type ChatInputCommandInteraction,
    Collection,
    type ComponentType,
    Events,
    MessageFlags,
    type User,
    type UserSelectMenuInteraction,
} from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenu, type SelectMenuContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider } from "../src/guards/index.ts";

type UserContext = SelectMenuContext<ComponentType.UserSelect>;

class UserMenu extends SelectMenu<ComponentType.UserSelect> {
    constructor(
        private readonly execute: (ctx: UserContext) => Promise<void>,
        guards: readonly GuardProvider<UserContext>[] = [],
    ) {
        super({
            builder: new UserSelectMenuBuilder().setCustomId("user.choose"),
            guards,
        });
    }

    run(ctx: UserContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", ids = ["selected"]) => {
    const reply = mock.fn(async (_payload: unknown) => {});
    const editReply = mock.fn(async (_payload: unknown) => {});
    const followUp = mock.fn(async (_payload: unknown) => {});
    const update = mock.fn(async (_payload: unknown) => {});
    const value = {
        id: "user-selection",
        customId: "user.choose",
        values: ids,
        users: new Collection(
            ids.map(id => [id, { id, username: `name-${id}` } as User]),
        ),
        members: new Collection(),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => true,
        reply,
        editReply,
        followUp,
        update,
    } as unknown as UserSelectMenuInteraction;

    return { value, reply, editReply, followUp, update };
};

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

    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

test("user select listener provides resolved users and scoped logs without logging selections", async t => {
    const { client, records } = await setup(t);
    class Inspect extends UserMenu {
        async run(ctx: UserContext) {
            assert.equal(this.customId, "user.choose");
            assert.equal(ctx.client, client);
            assert.deepEqual(ctx.interaction.values, ["first", "second"]);
            assert.equal(ctx.interaction.members.size, 0);

            const names = await Promise.resolve(
                ctx.interaction.users.map(user => user.username),
            );
            await ctx.interaction.reply(names.join(", "));
        }
    }
    client.selectMenus.set("user.choose", new Inspect(async () => {}));
    const fixture = interaction("new", ["first", "second"]);
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();

    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        "name-first, name-second",
    );
    const completed = records.find(
        record => record.event === "select-menu.completed",
    );
    assert.equal(completed?.selectMenu, "user.choose");
    assert.equal(completed?.interactionId, "user-selection");
    assert.equal(typeof completed?.durationMs, "number");
    assert.ok(!JSON.stringify(records).includes("name-first"));
});

test("unknown IDs and type mismatches never run a handler or guard", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: UserContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.selectMenus.set("user.choose", new UserMenu(execute, [factory]));

    const wrongType = interaction();
    Object.assign(wrongType.value, {
        isUserSelectMenu: () => false,
        isStringSelectMenu: () => true,
    });
    const unknown = interaction();
    Object.assign(unknown.value, { customId: "unknown" });
    await dispatcher.dispatch(wrongType.value);
    await dispatcher.dispatch(unknown.value);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(wrongType.reply.mock.callCount(), 0);
    assert.equal(unknown.reply.mock.callCount(), 0);
});

test("user select guards resolve lazily with resolved users and support custom rejection", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<UserContext> {
        constructor() {
            super({ description: "Denied" });
        }
        run(ctx: UserContext) {
            return ctx.interaction.users.size === 0;
        }
        async onFail(ctx: UserContext) {
            await ctx.interaction.reply("Choose someone else.");
        }
    }
    const execute = mock.fn(async (_ctx: UserContext) => {});
    const factory = mock.fn(async (ctx: UserContext) => {
        assert.equal(ctx.interaction.users.first()?.id, "selected");
        return new Deny();
    });
    client.selectMenus.set("user.choose", new UserMenu(execute, [factory]));
    assert.equal(factory.mock.callCount(), 0);

    const fixture = interaction();
    await dispatcher.dispatch(fixture.value);

    assert.equal(factory.mock.callCount(), 1);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        "Choose someone else.",
    );
});

for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
    test(`user select failures respect ${phase} acknowledgment`, async t => {
        const { client, dispatcher } = await setup(t);
        client.selectMenus.set(
            "user.choose",
            new UserMenu(async () => {
                throw new Error("Private failure");
            }),
        );
        const fixture = interaction(phase);
        await dispatcher.dispatch(fixture.value);

        const response =
            phase === "new"
                ? fixture.reply
                : phase === "defer-reply"
                  ? fixture.editReply
                  : fixture.followUp;
        assert.deepEqual(response.mock.calls[0]?.arguments[0], {
            content: "Something went wrong while running this select menu.",
            ...(phase === "defer-reply"
                ? {}
                : { flags: MessageFlags.Ephemeral }),
        });
        if (phase === "defer-update")
            assert.equal(fixture.editReply.mock.callCount(), 0);
    });
}

test("development user command and filesystem menu complete the selection flow", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../dev/bot/", import.meta.url),
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(new URL("../dev/bot/", import.meta.url));
    const reply = mock.fn(async (_payload: unknown) => {});
    const dispatcher = new InteractionDispatcher(client);
    await dispatcher.dispatch({
        id: "user-command",
        commandName: "user",
        user: { id: "caller" },
        isChatInputCommand: () => true,
        reply,
    } as unknown as ChatInputCommandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /user.choose/,
    );

    const fixture = interaction();
    const template = client.selectMenus.get("user.choose")?.builder.toJSON();
    await dispatcher.dispatch(fixture.value);

    assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
        content: "Selected users: name-selected.",
        allowedMentions: { parse: [] },
    });
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.deepEqual(
        client.selectMenus.get("user.choose")?.builder.toJSON(),
        template,
    );
});
