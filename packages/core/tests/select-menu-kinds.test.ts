import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { ComponentType, Events, MessageFlags } from "discord.js";
import { defineGuard } from "../src/guards/index.ts";
import { assertPrivateFailure, phases } from "./support/acknowledgment.ts";
import {
    type AnySelectContext,
    createMenu,
    resolvedEntries,
    selectKinds,
} from "./support/select-kinds.ts";
import { createTestClient } from "./support/test-client.ts";

const deny = (description = "Denied") =>
    defineGuard<AnySelectContext>({
        name: "Deny",
        description,
        run: () => {
            return false;
        },
    });

for (const kind of selectKinds) {
    describe(`${kind.name} select menus`, () => {
        test("listener receives resolved data and logs without selections", async t => {
            const { client, records } = await createTestClient(t);
            const menu = createMenu(kind, async ctx => {
                assert.equal(ctx.client, client);
                assert.deepEqual(ctx.interaction.values, ["first", "second"]);

                const names = await Promise.resolve(
                    resolvedEntries(ctx.interaction).map(entry => entry.name),
                );
                await ctx.interaction.reply(names.join(", "));
            });
            client.selectMenus.set(kind.customId, menu);
            const fixture = kind.interaction({ ids: ["first", "second"] });
            client.emit(Events.InteractionCreate, fixture.interaction);
            await client.waitForAllListenersToComplete();

            assert.equal(fixture.reply.mock.callCount(), 1);
            assert.equal(
                fixture.reply.mock.calls[0]?.arguments[0],
                ["first", "second"].map(kind.label).join(", "),
            );
            const completed = records.find(
                record => record.event === "select-menu.completed",
            );
            assert.equal(completed?.selectMenu, kind.customId);
            assert.equal(completed?.interactionId, `${kind.name}-selection`);
            assert.equal(typeof completed?.durationMs, "number");
            assert.ok(!JSON.stringify(records).includes(kind.label("first")));
        });

        test("unknown IDs and other select types never run a handler or guard", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const execute = mock.fn(async () => {});
            const factory = mock.fn(() => {
                throw new Error("Must not run");
            });
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, execute, [factory]),
            );

            const notASelect = kind.interaction();
            Object.assign(notASelect.interaction, {
                componentType: ComponentType.ActionRow,
            });

            const untouched = [
                notASelect,
                kind.interaction({ customId: "unknown" }),
                ...selectKinds
                    .filter(other => other !== kind)
                    .map(other =>
                        other.interaction({ customId: kind.customId }),
                    ),
            ];
            for (const fixture of untouched) {
                await dispatcher.dispatch(fixture.interaction);

                assert.equal(fixture.reply.mock.callCount(), 0);
                assert.equal(fixture.update.mock.callCount(), 0);
            }

            assert.equal(execute.mock.callCount(), 0);
            assert.equal(factory.mock.callCount(), 0);
        });

        test("guard factories resolve lazily with resolved data and can reject with a custom reply", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const denyEmpty = () =>
                defineGuard<AnySelectContext>({
                    name: "DenyEmpty",
                    description: "Denied",
                    run: (ctx: AnySelectContext) => {
                        return resolvedEntries(ctx.interaction).length === 0;
                    },
                    onFail: async (ctx: AnySelectContext) => {
                        await ctx.interaction.reply("Choose again.");
                    },
                });
            const execute = mock.fn(async () => {});
            const factory = mock.fn(async (ctx: AnySelectContext) => {
                assert.equal(
                    resolvedEntries(ctx.interaction)[0]?.id,
                    "selected",
                );

                return denyEmpty();
            });
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, execute, [factory]),
            );
            assert.equal(factory.mock.callCount(), 0);

            const passing = kind.interaction();
            await dispatcher.dispatch(passing.interaction);

            assert.equal(factory.mock.callCount(), 1);
            assert.equal(execute.mock.callCount(), 0);
            assert.equal(
                passing.reply.mock.calls[0]?.arguments[0],
                "Choose again.",
            );
        });

        test("guard rejection stops later factories and handlers", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const later = mock.fn(() => deny());
            const execute = mock.fn(async () => {});
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, execute, [async () => deny(), later]),
            );
            const fixture = kind.interaction();
            await dispatcher.dispatch(fixture.interaction);

            assert.equal(later.mock.callCount(), 0);
            assert.equal(execute.mock.callCount(), 0);
            assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
                content: "Denied",
                flags: MessageFlags.Ephemeral,
            });
        });

        test("guard rejections and exceptions share the private response pipeline", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const execute = mock.fn(async () => {});
            const later = mock.fn(() => deny());

            for (const fails of [false, true]) {
                client.selectMenus.set(
                    kind.customId,
                    createMenu(kind, execute, [
                        () => {
                            if (fails) {
                                throw new Error("Private guard failure");
                            }

                            return deny("Choose again.");
                        },
                        later,
                    ]),
                );
                const fixture = kind.interaction({ phase: "defer-update" });
                await dispatcher.dispatch(fixture.interaction);

                assert.deepEqual(fixture.followUp.mock.calls[0]?.arguments[0], {
                    content: fails
                        ? "Something went wrong while running this select menu."
                        : "Choose again.",
                    flags: MessageFlags.Ephemeral,
                });
                assert.equal(fixture.editReply.mock.callCount(), 0);
            }

            assert.equal(execute.mock.callCount(), 0);
            assert.equal(later.mock.callCount(), 0);
        });

        test("handler failures reply privately for every acknowledgment phase", async t => {
            const { client, dispatcher } = await createTestClient(t);
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, async () => {
                    throw new Error("Private failure");
                }),
            );

            for (const phase of phases) {
                const fixture = kind.interaction({ phase });
                await dispatcher.dispatch(fixture.interaction);

                assertPrivateFailure(
                    fixture,
                    phase,
                    "Something went wrong while running this select menu.",
                );
            }
        });

        test("guard factory errors fail closed and contain expired response failures", async t => {
            const { client, records } = await createTestClient(t);
            const execute = mock.fn(async () => {});
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, execute, [
                    async () => {
                        throw new Error("Guard unavailable");
                    },
                ]),
            );
            const fixture = kind.interaction();
            fixture.reply.mock.mockImplementation(async () => {
                throw new Error("Expired");
            });
            client.emit(Events.InteractionCreate, fixture.interaction);
            await client.waitForAllListenersToComplete();

            assert.equal(execute.mock.callCount(), 0);
            assert.equal(
                records.find(record => record.event === "select-menu.failed")
                    ?.stage,
                "guards",
            );
            assert.ok(
                records.some(
                    record =>
                        record.event === "select-menu.error-response.failed",
                ),
            );
        });

        test("concurrent selections receive separate contexts without automatic acknowledgment", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const contexts: AnySelectContext[] = [];
            client.selectMenus.set(
                kind.customId,
                createMenu(kind, async ctx => {
                    contexts.push(ctx);
                    await Promise.resolve();
                    assert.equal(ctx.interaction.deferred, false);
                    assert.equal(ctx.interaction.replied, false);
                    await ctx.interaction.reply(
                        ctx.interaction.values.join(", "),
                    );
                }),
            );
            const first = kind.interaction({ ids: ["one"] });
            const second = kind.interaction({ ids: ["two", "three"] });

            await Promise.all([
                dispatcher.dispatch(first.interaction),
                dispatcher.dispatch(second.interaction),
            ]);

            assert.notEqual(contexts[0], contexts[1]);
            assert.equal(first.reply.mock.calls[0]?.arguments[0], "one");
            assert.equal(
                second.reply.mock.calls[0]?.arguments[0],
                "two, three",
            );
        });
    });
}
