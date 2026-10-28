import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import {
    ChannelType,
    Collection,
    ComponentType,
    Events,
    MessageFlags,
} from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenu, type SelectMenuContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider } from "../src/guards/index.ts";
import {
    createChatInputInteraction,
    createSelectInteraction,
} from "./fixtures/interactions.ts";

type ChannelContext = SelectMenuContext<ComponentType.ChannelSelect>;

class ChannelMenu extends SelectMenu<ComponentType.ChannelSelect> {
    constructor(
        private readonly execute: (ctx: ChannelContext) => Promise<void>,
        guards: readonly GuardProvider<ChannelContext>[] = [],
    ) {
        super({
            builder: new ChannelSelectMenuBuilder().setCustomId(
                "channel.choose",
            ),
            guards,
        });
    }

    run(ctx: ChannelContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", ids = ["selected"]) =>
    createSelectInteraction(ComponentType.ChannelSelect, {
        id: "channel-selection",
        customId: "channel.choose",
        values: ids,
        channels: new Collection(
            ids.map(id => [
                id,
                {
                    id,
                    name: `name-${id}`,
                    type: ChannelType.GuildText,
                },
            ]),
        ),
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

test("channel select listener provides resolved channels and scoped logs without logging selections", async t => {
    const { client, records } = await setup(t);
    class Inspect extends ChannelMenu {
        async run(ctx: ChannelContext) {
            assert.equal(this.customId, "channel.choose");
            assert.equal(ctx.client, client);
            assert.deepEqual(ctx.interaction.values, ["first", "second"]);

            const names = await Promise.resolve(
                ctx.interaction.channels.map(channel =>
                    "name" in channel ? channel.name : channel.id,
                ),
            );
            await ctx.interaction.reply(names.join(", "));
        }
    }
    client.selectMenus.set("channel.choose", new Inspect(async () => {}));
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
    assert.equal(completed?.selectMenu, "channel.choose");
    assert.equal(completed?.interactionId, "channel-selection");
    assert.equal(typeof completed?.durationMs, "number");
    assert.ok(!JSON.stringify(records).includes("name-first"));
});

test("unknown IDs and type mismatches never run a handler or guard", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: ChannelContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.selectMenus.set(
        "channel.choose",
        new ChannelMenu(execute, [factory]),
    );

    for (const componentType of [
        ComponentType.StringSelect,
        ComponentType.UserSelect,
        ComponentType.RoleSelect,
        ComponentType.MentionableSelect,
    ] as const) {
        const wrongType = interaction();
        Object.assign(wrongType.interaction, {
            componentType,
        });
        await dispatcher.dispatch(wrongType.interaction);
        assert.equal(wrongType.reply.mock.callCount(), 0);
    }
    const unknown = interaction();
    Object.assign(unknown.interaction, { customId: "unknown" });
    await dispatcher.dispatch(unknown.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(unknown.reply.mock.callCount(), 0);
});

test("channel select guards resolve lazily with resolved channels and support custom rejection", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<ChannelContext> {
        constructor() {
            super({ description: "Denied" });
        }
        run(ctx: ChannelContext) {
            return ctx.interaction.channels.size === 0;
        }
        async onFail(ctx: ChannelContext) {
            await ctx.interaction.reply("Choose another channel.");
        }
    }
    const execute = mock.fn(async (_ctx: ChannelContext) => {});
    const factory = mock.fn(async (ctx: ChannelContext) => {
        assert.equal(ctx.interaction.channels.first()?.id, "selected");
        return new Deny();
    });
    client.selectMenus.set(
        "channel.choose",
        new ChannelMenu(execute, [factory]),
    );
    assert.equal(factory.mock.callCount(), 0);

    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(factory.mock.callCount(), 1);
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        "Choose another channel.",
    );
});

test("channel interactions cannot invoke other select types with the same ID", async t => {
    const { client, dispatcher } = await setup(t);
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    const execute = mock.fn(async () => {});
    const menus = [
        new (class extends SelectMenu {
            constructor() {
                super({
                    builder: new StringSelectMenuBuilder()
                        .setCustomId("channel.choose")
                        .addOptions({ label: "Blue", value: "blue" }),
                    guards: [factory],
                });
            }
            run() {
                return execute();
            }
        })(),
        new (class extends SelectMenu<ComponentType.UserSelect> {
            constructor() {
                super({
                    builder: new UserSelectMenuBuilder().setCustomId(
                        "channel.choose",
                    ),
                    guards: [factory],
                });
            }
            run() {
                return execute();
            }
        })(),
        new (class extends SelectMenu<ComponentType.RoleSelect> {
            constructor() {
                super({
                    builder: new RoleSelectMenuBuilder().setCustomId(
                        "channel.choose",
                    ),
                    guards: [factory],
                });
            }
            run() {
                return execute();
            }
        })(),
        new (class extends SelectMenu<ComponentType.MentionableSelect> {
            constructor() {
                super({
                    builder: new MentionableSelectMenuBuilder().setCustomId(
                        "channel.choose",
                    ),
                    guards: [factory],
                });
            }
            run() {
                return execute();
            }
        })(),
    ];

    for (const menu of menus) {
        client.selectMenus.set("channel.choose", menu);
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.equal(fixture.update.mock.callCount(), 0);
    }
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
});

test("channel guard rejection and exceptions use the shared private response pipeline", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<ChannelContext> {
        constructor() {
            super({ description: "Choose another channel." });
        }
        run() {
            return false;
        }
    }
    const execute = mock.fn(async (_ctx: ChannelContext) => {});
    const later = mock.fn(() => new Deny());
    for (const fails of [false, true]) {
        client.selectMenus.set(
            "channel.choose",
            new ChannelMenu(execute, [
                () => {
                    if (fails) throw new Error("Private guard failure");
                    return new Deny();
                },
                later,
            ]),
        );
        const fixture = interaction("defer-update");
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(fixture.followUp.mock.calls[0]?.arguments[0], {
            content: fails
                ? "Something went wrong while running this select menu."
                : "Choose another channel.",
            flags: MessageFlags.Ephemeral,
        });
        assert.equal(fixture.editReply.mock.callCount(), 0);
    }
    assert.equal(execute.mock.callCount(), 0);
    assert.equal(later.mock.callCount(), 0);
});

for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
    test(`channel select failures respect ${phase} acknowledgment`, async t => {
        const { client, dispatcher } = await setup(t);
        client.selectMenus.set(
            "channel.choose",
            new ChannelMenu(async () => {
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

for (const [label, ids, expected] of [
    ["multiple", ["second", "first"], "name-second, name-first"],
    ["empty", [], "None"],
    ["unnamed", ["unnamed"], "unnamed"],
    ["missing", ["missing"], "missing"],
] as const) {
    test(`development channel command and filesystem menu handle ${label} selections`, async t => {
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
                id: "channel-command",
                commandName: "channel",
                user: { id: "caller" },
            });
        await dispatcher.dispatch(commandInteraction);
        const payload = reply.mock.calls[0]?.arguments[0] as {
            components: { toJSON(): unknown }[];
        };
        assert.match(
            JSON.stringify(payload.components[0]?.toJSON()),
            /channel.choose/,
        );
        const menu = client.selectMenus.get("channel.choose");
        assert.ok(menu);
        assert.equal(menu.componentType, ComponentType.ChannelSelect);
        assert.deepEqual(menu.builder.toJSON().channel_types, [
            ChannelType.GuildText,
            ChannelType.GuildVoice,
        ]);

        const fixture = interaction("new", [...ids]);
        if (label === "unnamed") {
            Object.assign(fixture.interaction.channels.get("unnamed") ?? {}, {
                name: null,
            });
        } else if (label === "missing") {
            fixture.interaction.channels.clear();
        }
        const template = client.selectMenus
            .get("channel.choose")
            ?.builder.toJSON();
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(fixture.update.mock.calls[0]?.arguments[0], {
            content: `Selected channels: ${expected}.`,
            allowedMentions: { parse: [] },
        });
        assert.equal(fixture.reply.mock.callCount(), 0);
        assert.deepEqual(
            client.selectMenus.get("channel.choose")?.builder.toJSON(),
            template,
        );
    });
}
