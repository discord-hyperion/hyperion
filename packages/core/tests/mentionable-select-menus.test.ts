import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Events, MessageFlags } from "discord.js";
import { defineGuard } from "../src/guards/index.ts";
import {
    type AnySelectContext,
    createMenu,
    selectKinds,
} from "./support/select-kinds.ts";
import { createTestClient } from "./support/test-client.ts";

// The shared suite covers dispatch behaviour; these cover mixed user and role data.
const mentionable = selectKinds.find(kind => kind.name === "mentionable");
if (!mentionable) throw new Error("Missing mentionable select kind.");

const mixed = (ids = ["person", "role"]) => mentionable.interaction({ ids });

test("mentionable listener exposes users and roles without logging either", async t => {
    const { client, records } = await createTestClient(t);
    client.selectMenus.set(
        mentionable.customId,
        createMenu(mentionable, async ctx => {
            const { interaction } = ctx;
            assert.ok(interaction.isMentionableSelectMenu());
            assert.equal(interaction.users.first()?.id, "person");
            assert.equal(interaction.users.first()?.username, "name-person");
            assert.equal(interaction.roles.first()?.id, "role");
            assert.equal(interaction.roles.first()?.name, "name-role");
            await interaction.reply("Resolved");
        }),
    );
    const fixture = mixed();
    client.emit(Events.InteractionCreate, fixture.interaction);
    await client.waitForAllListenersToComplete();

    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Resolved");
    assert.ok(!JSON.stringify(records).includes("name-person"));
    assert.ok(!JSON.stringify(records).includes("name-role"));
});

test("mentionable guard factories receive mixed resolved data and can reject a selection", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const denyRoles = () =>
        defineGuard<AnySelectContext>({
            name: "DenyRoles",
            description: "Choose users only.",
            run(ctx: AnySelectContext) {
                return (
                    ctx.interaction.isMentionableSelectMenu() &&
                    ctx.interaction.roles.size === 0
                );
            },
        });
    const execute = mock.fn(async () => {});
    const factory = mock.fn(async (ctx: AnySelectContext) => {
        assert.ok(ctx.interaction.isMentionableSelectMenu());
        assert.equal(ctx.interaction.users.first()?.id, "person");

        return denyRoles();
    });
    client.selectMenus.set(
        mentionable.customId,
        createMenu(mentionable, execute, [factory]),
    );
    assert.equal(factory.mock.callCount(), 0);

    const rejected = mixed();
    await dispatcher.dispatch(rejected.interaction);

    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(rejected.reply.mock.calls[0]?.arguments[0], {
        content: "Choose users only.",
        flags: MessageFlags.Ephemeral,
    });

    await dispatcher.dispatch(mixed(["person"]).interaction);

    assert.equal(execute.mock.callCount(), 1);
});
