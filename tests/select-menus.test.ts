import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { StringSelectMenuBuilder } from "@discordjs/builders";
import {
    Events,
    MessageFlags,
    type StringSelectMenuInteraction,
} from "discord.js";
import { HyperionClient } from "../src/client/index.ts";
import { SelectMenu, type SelectMenuContext } from "../src/components/index.ts";
import { InteractionDispatcher } from "../src/execution/index.ts";
import { Guard, type GuardProvider } from "../src/guards/index.ts";

class Menu extends SelectMenu {
    constructor(
        private readonly execute: (ctx: SelectMenuContext) => Promise<void>,
        guards: readonly GuardProvider<SelectMenuContext>[] = [],
    ) {
        super({
            builder: new StringSelectMenuBuilder()
                .setCustomId("colour.choose")
                .addOptions({ label: "Blue", value: "blue" }),
            guards,
        });
    }

    run(ctx: SelectMenuContext) {
        return this.execute(ctx);
    }
}

const interaction = (phase = "new", customId = "colour.choose") => {
    const reply = mock.fn(async (_payload: unknown) => {});
    const editReply = mock.fn(async (_payload: unknown) => {});
    const followUp = mock.fn(async (_payload: unknown) => {});
    const value = {
        id: "selection",
        customId,
        values: ["blue"],
        user: { id: "user" },
        deferred: phase.startsWith("defer"),
        replied: phase === "replied",
        ephemeral: phase === "defer-reply" ? true : null,
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => true,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        reply,
        editReply,
        followUp,
    } as unknown as StringSelectMenuInteraction;
    return { value, reply, editReply, followUp };
};

const setup = async (t: { after: (callback: () => Promise<void>) => void }) => {
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

test("select menu listener preserves the receiver, typed values, and scoped logs", async t => {
    const { client, records } = await setup(t);
    class Colour extends Menu {
        async run(ctx: SelectMenuContext) {
            assert.equal(this.customId, "colour.choose");
            const colour = await Promise.resolve(ctx.interaction.values[0]);
            await ctx.interaction.reply(colour ?? "No selection");
        }
    }
    client.selectMenus.set("colour.choose", new Colour(async () => {}));
    const fixture = interaction();
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "blue");
    const completed = records.find(
        record => record.event === "select-menu.completed",
    );
    assert.equal(completed?.selectMenu, "colour.choose");
    assert.equal(completed?.interactionId, "selection");
    assert.equal(typeof completed?.durationMs, "number");
});

test("unmatched IDs and unsupported selects are not acknowledged", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: SelectMenuContext) => {});
    client.selectMenus.set("colour.choose", new Menu(execute));
    const unknown = interaction("new", "unknown");
    await dispatcher.dispatch(unknown.value);
    const unsupported = interaction();
    Object.assign(unsupported.value, {
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
    });
    await dispatcher.dispatch(unsupported.value);

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(unknown.reply.mock.callCount(), 0);
    assert.equal(unsupported.reply.mock.callCount(), 0);
});

test("select menu guard rejection stops later factories and handlers", async t => {
    const { client, dispatcher } = await setup(t);
    class Deny extends Guard<SelectMenuContext> {
        constructor() {
            super({ description: "Denied" });
        }
        run() {
            return false;
        }
    }
    const later = mock.fn(() => new Deny());
    const execute = mock.fn(async (_ctx: SelectMenuContext) => {});
    client.selectMenus.set(
        "colour.choose",
        new Menu(execute, [async () => new Deny(), later]),
    );
    const fixture = interaction();
    await dispatcher.dispatch(fixture.value);

    assert.equal(later.mock.callCount(), 0);
    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
        content: "Denied",
        flags: MessageFlags.Ephemeral,
    });
});

for (const phase of ["new", "defer-update", "defer-reply", "replied"]) {
    test(`select menu failures respect ${phase} acknowledgment`, async t => {
        const { client, dispatcher } = await setup(t);
        client.selectMenus.set(
            "colour.choose",
            new Menu(async () => {
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

test("guard factory errors fail closed and contain expired response failures", async t => {
    const { client, records } = await setup(t);
    const execute = mock.fn(async (_ctx: SelectMenuContext) => {});
    client.selectMenus.set(
        "colour.choose",
        new Menu(execute, [
            async () => {
                throw new Error("Guard unavailable");
            },
        ]),
    );
    const fixture = interaction();
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();

    assert.equal(execute.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "select-menu.failed")?.stage,
        "guards",
    );
    assert.ok(
        records.some(
            record => record.event === "select-menu.error-response.failed",
        ),
    );
});

test("concurrent selections receive separate contexts without automatic acknowledgment", async t => {
    const { client, dispatcher } = await setup(t);
    const contexts: SelectMenuContext[] = [];
    client.selectMenus.set(
        "colour.choose",
        new Menu(async ctx => {
            contexts.push(ctx);
            await Promise.resolve();
            assert.equal(ctx.interaction.deferred, false);
            assert.equal(ctx.interaction.replied, false);
            await ctx.interaction.reply(ctx.interaction.values.join(", "));
        }),
    );
    const first = interaction();
    const second = interaction();
    Object.assign(second.value, { values: ["green", "red"] });
    await Promise.all([
        dispatcher.dispatch(first.value),
        dispatcher.dispatch(second.value),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(first.reply.mock.calls[0]?.arguments[0], "blue");
    assert.equal(second.reply.mock.calls[0]?.arguments[0], "green, red");
});

test("development colour command and filesystem menu complete the selection flow", async t => {
    const client = await HyperionClient.create({
        name: "Test",
        root: new URL("../dev/bot/", import.meta.url),
        discord: { intents: [] },
        logging: false,
    });
    t.after(() => client.destroy());
    await client.commands.load(new URL("../dev/bot/", import.meta.url));
    const command = client.commands.get("colour");
    assert.ok(command);
    const reply = mock.fn(async (_payload: unknown) => {});
    const dispatcher = new InteractionDispatcher(client);
    await dispatcher.dispatch({
        id: "colour-command",
        commandName: "colour",
        user: { id: "user" },
        isChatInputCommand: () => true,
        reply,
    } as unknown as import("discord.js").ChatInputCommandInteraction);
    const payload = reply.mock.calls[0]?.arguments[0] as {
        components: { toJSON(): unknown }[];
    };
    assert.match(
        JSON.stringify(payload.components[0]?.toJSON()),
        /colour.choose/,
    );

    const fixture = interaction();
    const update = mock.fn(async (_payload: unknown) => {});
    Object.assign(fixture.value, { update });
    const template = client.selectMenus.get("colour.choose")?.builder.toJSON();
    await dispatcher.dispatch(fixture.value);

    assert.deepEqual(update.mock.calls[0]?.arguments[0], {
        content: "You chose blue.",
        allowedMentions: { parse: [] },
    });
    assert.deepEqual(
        client.selectMenus.get("colour.choose")?.builder.toJSON(),
        template,
    );
    assert.equal(fixture.reply.mock.callCount(), 0);
});
