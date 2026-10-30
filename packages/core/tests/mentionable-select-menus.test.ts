import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { Collection, ComponentType, Events, MessageFlags } from "discord.js";
import { createSelectInteraction } from "../../../tests/fixtures/interactions.ts";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenu, type SelectMenuContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider } from "../src/guards/index.ts";

type MentionableContext = SelectMenuContext<ComponentType.MentionableSelect>;

class MentionableMenu extends SelectMenu<ComponentType.MentionableSelect> {
    constructor(
        private readonly execute: (ctx: MentionableContext) => Promise<void>,
        guards: readonly GuardProvider<MentionableContext>[] = [],
    ) {
        super({
            builder: new MentionableSelectMenuBuilder().setCustomId(
                "mentionable.choose",
            ),
            guards,
        });
    }

    run(ctx: MentionableContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", values = ["role", "person"]) =>
    createSelectInteraction(ComponentType.MentionableSelect, {
        id: "mentionable-selection",
        customId: "mentionable.choose",
        values,
        users: new Collection(
            values.includes("person")
                ? [["person", { id: "person", username: "Selected user" }]]
                : [],
        ),
        roles: new Collection(
            values.includes("role")
                ? [["role", { id: "role", name: "Selected role" }]]
                : [],
        ),
        members: new Collection(),
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

test("mentionable listener exposes mixed resolved data and scoped logs without logging selections", async t => {
    const { client, records } = await setup(t);
    class Inspect extends MentionableMenu {
        async run(ctx: MentionableContext) {
            assert.equal(this.customId, "mentionable.choose");
            assert.equal(ctx.client, client);
            assert.deepEqual(ctx.interaction.values, ["role", "person"]);
            assert.equal(
                ctx.interaction.users.first()?.username,
                "Selected user",
            );
            assert.equal(ctx.interaction.roles.first()?.name, "Selected role");
            assert.equal(ctx.interaction.members.size, 0);

            await ctx.interaction.reply(await Promise.resolve("Resolved"));
        }
    }
    client.selectMenus.set("mentionable.choose", new Inspect(async () => {}));
    const fixture = interaction();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Resolved");
    const completed = records.find(
        record => record.event === "select-menu.completed",
    );
    assert.equal(completed?.selectMenu, "mentionable.choose");
    assert.equal(completed?.interactionId, "mentionable-selection");
    assert.equal(typeof completed?.durationMs, "number");
    assert.ok(!JSON.stringify(records).includes("Selected user"));
    assert.ok(!JSON.stringify(records).includes("Selected role"));
});

test("unknown IDs and string, user, and role type mismatches leave interactions untouched", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: MentionableContext) => {});
    const factory = mock.fn(() => {
        throw new Error("Must not run");
    });
    client.selectMenus.set(
        "mentionable.choose",
        new MentionableMenu(execute, [factory]),
    );

    for (const componentType of [
        ComponentType.StringSelect,
        ComponentType.UserSelect,
        ComponentType.RoleSelect,
    ] as const) {
        const fixture = interaction();
        Object.assign(fixture.interaction, {
            componentType,
        });
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(fixture.reply.mock.callCount(), 0);
    }
    const unknown = interaction();
    Object.assign(unknown.interaction, { customId: "unknown" });
    await dispatcher.dispatch(unknown.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(factory.mock.callCount(), 0);
    assert.equal(unknown.reply.mock.callCount(), 0);
});

test("mentionable guard factories receive mixed resolved data and can reject a selection", async t => {
    const { client, dispatcher } = await setup(t);
    class DenyRoles extends Guard<MentionableContext> {
        constructor() {
            super({ description: "Choose users only." });
        }
        run(ctx: MentionableContext) {
            return ctx.interaction.roles.size === 0;
        }
    }
    const execute = mock.fn(async (_ctx: MentionableContext) => {});
    const factory = mock.fn(async (ctx: MentionableContext) => {
        assert.equal(ctx.interaction.users.first()?.id, "person");
        return new DenyRoles();
    });
    client.selectMenus.set(
        "mentionable.choose",
        new MentionableMenu(execute, [factory]),
    );
    assert.equal(factory.mock.callCount(), 0);
    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content: "Choose users only.",
        flags: MessageFlags.Ephemeral,
    });
    await dispatcher.dispatch(interaction("new", ["person"]).interaction);
    assert.equal(execute.mock.callCount(), 1);
});

for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
    test(`mentionable failures respect ${phase} acknowledgment`, async t => {
        const { client, dispatcher } = await setup(t);
        client.selectMenus.set(
            "mentionable.choose",
            new MentionableMenu(async () => {
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
