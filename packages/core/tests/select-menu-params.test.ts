import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, mock, test } from "node:test";
import { StringSelectMenuBuilder } from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ComponentType, MessageFlags } from "discord.js";
import { createButtonInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    type AnySelectMenu,
    Button,
    type ButtonContext,
    defineParams,
    SelectMenu,
    type SelectMenuContext,
} from "../src/components/index.ts";
import { type GuardProvider, ParamOwner } from "../src/guards/index.ts";
import { SelectMenuRegistry } from "../src/registries/index.ts";
import { selectMenuKind } from "./support/component-kinds.ts";
import { type SelectKind, selectKinds } from "./support/select-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";
import { createTestClient } from "./support/test-client.ts";

// Hand-rolled so tests can count validations; "bad" fails like a forged ID.
const validate = mock.fn((value: unknown) =>
    (value as { owner: string }).owner === "bad"
        ? { issues: [{ message: "Invalid owner" }] }
        : { value: value as { owner: string } },
);
const schema: StandardSchemaV1<Record<string, string>, { owner: string }> = {
    "~standard": { version: 1, vendor: "test", validate },
};
const pick = defineParams({ id: "pick", keys: ["owner"], schema });

type PickContext = SelectMenuContext<ComponentType.StringSelect, typeof pick>;
type Run = (ctx: PickContext) => Promise<void>;

/** A params menu of any kind; the generic is fixed because kinds are a runtime table. */
const createParamsMenu = (
    kind: SelectKind,
    execute: Run,
    guards: readonly GuardProvider<PickContext>[] = [],
) =>
    new (class extends SelectMenu<ComponentType.StringSelect, typeof pick> {
        constructor() {
            super({
                componentType: kind.type as ComponentType.StringSelect,
                params: pick,
                guards,
            });
        }

        run(ctx: PickContext) {
            return execute(ctx);
        }
    })() as unknown as AnySelectMenu;

for (const kind of selectKinds) {
    describe(`${kind.name} select menu params`, () => {
        test("params and the selection reach the handler separately", async t => {
            const { client, dispatcher, records } = await createTestClient(t);
            const execute = mock.fn<Run>(async ctx => {
                assert.deepEqual(ctx.params, [null, { owner: "caller" }]);
                assert.deepEqual(ctx.interaction.values, ["first", "second"]);
                await ctx.interaction.update({ content: "picked" });
            });
            client.selectMenus.routes.set(
                pick.id,
                createParamsMenu(kind, execute, [new ParamOwner("owner")]),
            );
            const fixture = kind.interaction({
                customId: pick({ owner: "caller" }),
                ids: ["first", "second"],
            });
            await dispatcher.dispatch(fixture.interaction);

            assert.equal(execute.mock.callCount(), 1);
            assert.equal(fixture.update.mock.callCount(), 1);
            assert.equal(
                records.find(record => record.event === "select-menu.completed")
                    ?.selectMenu,
                "pick",
            );
            assert.ok(!JSON.stringify(records).includes("pick:caller"));
        });

        test("other select types never decode or validate the params", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const execute = mock.fn<Run>(async () => {});
            client.selectMenus.routes.set(
                pick.id,
                createParamsMenu(kind, execute),
            );
            validate.mock.resetCalls();

            for (const other of selectKinds.filter(entry => entry !== kind)) {
                const fixture = other.interaction({
                    customId: pick({ owner: "caller" }),
                });
                await dispatcher.dispatch(fixture.interaction);

                assert.equal(fixture.reply.mock.callCount(), 0);
                assert.equal(fixture.update.mock.callCount(), 0);
            }

            assert.equal(validate.mock.callCount(), 0);
            assert.equal(execute.mock.callCount(), 0);
        });

        test("ParamOwner rejects other users and invalid params with its description", async t => {
            const { client, dispatcher } = await createTestClient(t);
            const execute = mock.fn<Run>(async () => {});
            client.selectMenus.routes.set(
                pick.id,
                createParamsMenu(kind, execute, [
                    new ParamOwner("owner", "Not yours."),
                ]),
            );

            for (const owner of ["someone-else", "bad"]) {
                const fixture = kind.interaction({ customId: pick({ owner }) });
                await dispatcher.dispatch(fixture.interaction);

                assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
                    content: "Not yours.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            assert.equal(execute.mock.callCount(), 0);
        });
    });
}

describe("select menu params definitions", () => {
    test("handlers require exactly one of a builder or params, and a select type", () => {
        const construct = (options: object) =>
            new (class extends SelectMenu<
                ComponentType.StringSelect,
                typeof pick
            > {
                constructor() {
                    super(options as never);
                }

                async run() {}
            })();

        assert.throws(
            () =>
                construct({
                    componentType: ComponentType.StringSelect,
                    params: pick,
                    builder: new StringSelectMenuBuilder().setCustomId("x"),
                }),
            /either a builder or params/,
        );
        for (const componentType of [undefined, ComponentType.Button, 99]) {
            assert.throws(
                () => construct({ componentType, params: pick }),
                /require a select componentType/,
            );
        }
        assert.throws(() => construct({}), /require a builder or params/);
    });

    test("routes are unique across every select type and literal ID", async t => {
        const { root, directory } = await createHandlerRoot(
            t,
            "hyperion-select-params-",
            "select-menus",
        );
        const source = (route: string, componentType: ComponentType) => `
            import { SelectMenu, defineParams } from ${JSON.stringify(new URL("../src/components/index.ts", import.meta.url).href)};
            const params = defineParams({ id: ${JSON.stringify(route)}, keys: [], schema: { "~standard": { version: 1, vendor: "test", validate: value => ({ value }) } } });
            export default class extends SelectMenu {
                constructor() { super({ componentType: ${componentType}, params }); }
                async run() {}
            }
        `;
        const registry = new SelectMenuRegistry();
        await writeFile(
            path.join(directory, "user.mjs"),
            source("a.route", ComponentType.UserSelect),
        );
        await registry.load(root);
        const original = registry.routes.get("a.route");

        assert.equal(original?.componentType, ComponentType.UserSelect);
        assert.equal(registry.size, 0);

        const cases: [string, string, RegExp][] = [
            [
                "string",
                source("a.route", ComponentType.StringSelect),
                /Duplicate select menu route "a\.route"/,
            ],
            [
                "literal",
                selectMenuKind.source("a.route"),
                /route "a\.route" collides with a literal custom ID/,
            ],
        ];
        // Module URLs are cached, so every case gets its own file.
        for (const [name, caseSource, error] of cases) {
            const file = path.join(directory, `${name}.mjs`);
            await writeFile(file, caseSource);

            await assert.rejects(registry.load(root), error);
            assert.equal(registry.routes.get("a.route"), original);

            await rm(file);
        }
    });
});

test("ParamOwner works on button params with the default description", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const execute = mock.fn(async () => {});
    client.buttons.routes.set(
        pick.id,
        new (class extends Button<typeof pick> {
            constructor() {
                super({ params: pick, guards: [new ParamOwner("owner")] });
            }

            run(_ctx: ButtonContext<typeof pick>) {
                return execute();
            }
        })() as never,
    );

    const owner = createButtonInteraction({
        customId: pick({ owner: "clicker" }),
        user: { id: "clicker" },
    });
    await dispatcher.dispatch(owner.interaction);
    const other = createButtonInteraction({
        customId: pick({ owner: "clicker" }),
        user: { id: "other" },
    });
    await dispatcher.dispatch(other.interaction);

    assert.equal(execute.mock.callCount(), 1);
    assert.deepEqual(other.reply.mock.calls[0]?.arguments[0], {
        content: "Only the person this was sent for can use it.",
        flags: MessageFlags.Ephemeral,
    });
});
