import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { RoleSelectMenuBuilder } from "@discordjs/builders";
import { Collection, ComponentType, Events, MessageFlags } from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenu, type SelectMenuContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider } from "../src/guards/index.ts";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "./fixtures/interactions.ts";

type RoleContext = SelectMenuContext<ComponentType.RoleSelect>;

class RoleMenu extends SelectMenu<ComponentType.RoleSelect> {
    constructor(
        private readonly execute: (ctx: RoleContext) => Promise<void>,
        guards: readonly GuardProvider<RoleContext>[] = [],
    ) {
        super({
            builder: new RoleSelectMenuBuilder().setCustomId("role.choose"),
            guards,
        });
    }

    run(ctx: RoleContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", ids = ["selected"]) =>
    createSelectInteraction(ComponentType.RoleSelect, {
        id: "role-selection",
        customId: "role.choose",
        values: ids,
        roles: new Collection(ids.map(id => [id, { id, name: `name-${id}` }])),
        user: { id: "caller" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
    });

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

test("role select listener provides resolved roles and scoped logs without logging selections", async t => {
    const { client, records } = await setup(t);
    class Inspect extends RoleMenu {
        async run(ctx: RoleContext) {
            assert.equal(this.customId, "role.choose");
            assert.equal(ctx.client, client);
            assert.deepEqual(ctx.interaction.values, ["first", "second"]);

            const names = await Promise.resolve(
                ctx.interaction.roles.map(role => role.name),
            );
            await ctx.interaction.reply(names.join(", "));
        }
    }
    client.selectMenus.set("role.choose", new Inspect(async () => {}));
    const fixture = interaction("new", ["first", "second"]);
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        "name-first, name-second",
    );
    const completed = records.find(
        record => record.event === "select-menu.completed",
    );
    assert.equal(completed?.selectMenu, "role.choose");
    assert.equal(completed?.interactionId, "role-selection");
    assert.equal(typeof completed?.durationMs, "number");
    assert.ok(!JSON.stringify(records).includes("name-first"));
});

test("unknown IDs and type mismatches never run a handler or guard", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: RoleContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.selectMenus.set("role.choose", new RoleMenu(execute, [factory]));

    const wrongType = interaction();
    Object.assign(wrongType.interaction, {
        componentType: ComponentType.StringSelect,
    });
    const unknown = interaction();
    Object.assign(unknown.interaction, { customId: "unknown" });
    await dispatcher.dispatch(wrongType.interaction);
    await dispatcher.dispatch(unknown.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(wrongType.reply.mock.callCount(), 0);
    assert.equal(unknown.reply.mock.callCount(), 0);
});

test("role select guards resolve lazily with resolved roles and support custom rejection", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<RoleContext> {
        constructor() {
            super({ description: "Denied" });
        }
        run(ctx: RoleContext) {
            return ctx.interaction.roles.size === 0;
        }
        async onFail(ctx: RoleContext) {
            await ctx.interaction.reply("Choose another role.");
        }
    }
    const execute = mock.fn(async (_ctx: RoleContext) => {});
    const factory = mock.fn(async (ctx: RoleContext) => {
        assert.equal(ctx.interaction.roles.first()?.id, "selected");
        return new Deny();
    });
    client.selectMenus.set("role.choose", new RoleMenu(execute, [factory]));
    assert.equal(factory.mock.callCount(), 0);

    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(factory.mock.callCount(), 1);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        "Choose another role.",
    );
});

for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
    test(`role select failures respect ${phase} acknowledgment`, async t => {
        const { client, dispatcher } = await setup(t);
        client.selectMenus.set(
            "role.choose",
            new RoleMenu(async () => {
                throw new Error("Private failure");
            }),
        );
        const fixture = interaction(phase);
        await dispatcher.dispatch(fixture.interaction);

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

test("development role command and filesystem menu complete the selection flow", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../dev/bot/", import.meta.url),
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(new URL("../dev/bot/", import.meta.url));
    const dispatcher = new InteractionDispatcher(client);
    const { interaction: commandInteraction, reply } =
        createChatInputInteraction({
            id: "role-command",
            commandName: "role",
            user: { id: "caller" },
        });
    await dispatcher.dispatch(commandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /role.choose/,
    );

    const fixture = interaction();
    const template = client.selectMenus.get("role.choose")?.builder.toJSON();
    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
        content: "Selected roles: name-selected.",
        allowedMentions: { parse: [] },
    });
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.deepEqual(
        client.selectMenus.get("role.choose")?.builder.toJSON(),
        template,
    );
});
