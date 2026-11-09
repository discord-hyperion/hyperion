import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ComponentType, MessageFlags } from "discord.js";
import {
    createModalInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";
import {
    type AnySelectMenuHandler,
    defineGuard,
    defineModal,
    defineParams,
    defineSelectMenu,
    type GuardProvider,
    type SelectMenuContext,
    type SelectMenuInputDefinition,
} from "../src/index.ts";
import { selectKinds } from "./support/select-kinds.ts";
import { createTestClient } from "./support/test-client.ts";

const schema = (
    validate: StandardSchemaV1["~standard"]["validate"],
): StandardSchemaV1 => ({
    "~standard": { version: 1, vendor: "test", validate },
});
const pick = defineParams({
    id: "pick",
    keys: ["owner"],
    schema: schema(value => ({ value })),
});

type Spec = { input: SelectMenuInputDefinition };
type Run = (ctx: SelectMenuContext<Spec>) => Promise<void>;

const inputMenu = (
    input: SelectMenuInputDefinition,
    execute: Run,
    guards: readonly GuardProvider<SelectMenuContext>[] = [],
    componentType = ComponentType.StringSelect,
    customId = "todo.priority",
): AnySelectMenuHandler =>
    defineSelectMenu({
        componentType: componentType as ComponentType.StringSelect,
        customId,
        // An erased definition stands in for whatever input a case tests.
        input: input as never,
        guards,
        run: ctx => execute(ctx as unknown as SelectMenuContext<Spec>),
    });

const check = (
    predicate: (ctx: SelectMenuContext) => boolean | Promise<boolean>,
) =>
    defineGuard<SelectMenuContext>({
        name: "Check",
        description: "Denied",
        run: (ctx: SelectMenuContext) => {
            return predicate(ctx);
        },
    });

const selection = (values: readonly string[] = ["high"]) =>
    createSelectInteraction(ComponentType.StringSelect, {
        customId: "todo.priority",
        values,
    });

test("select guards precede deferral, schema, resolver, and handler", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const order: string[] = [];
    const fixture = selection(["high", "private-value"]);
    const input = {
        defer: true,
        schema: schema(async values => {
            order.push("schema");
            assert.equal(fixture.interaction.deferred, true);
            assert.deepEqual(values, ["high", "private-value"]);

            return { value: { first: (values as string[])[0] } };
        }),
        resolve: async (value: unknown, ctx: SelectMenuContext) => {
            order.push("resolve");
            assert.deepEqual(value, { first: "high" });
            assert.equal("input" in ctx, false);

            return { priority: "high" };
        },
    };
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            input,
            async ctx => {
                order.push("handler");
                assert.deepEqual(ctx.input, [null, { priority: "high" }]);
                await ctx.interaction.editReply("Saved");
            },
            [
                check(ctx => {
                    order.push("guard");
                    assert.equal(ctx.interaction.deferred, false);
                    assert.equal("input" in ctx, false);

                    return true;
                }),
            ],
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(order, ["guard", "schema", "resolve", "handler"]);
    assert.deepEqual(fixture.deferReply.mock.calls[0]?.arguments[0], {
        flags: MessageFlags.Ephemeral,
    });
    assert.ok(!JSON.stringify(records).includes("private-value"));
});

test("every select kind passes its selected values or IDs to the schema", async t => {
    for (const kind of selectKinds) {
        const { client, dispatcher } = await createTestClient(t);
        const validate = mock.fn(values => ({ value: values }));
        const run = mock.fn<Run>(async ctx => {
            assert.deepEqual(ctx.input, [null, ["first", "second"]]);
        });
        client.selectMenus.set(
            kind.customId,
            inputMenu(
                { schema: schema(validate) },
                run,
                [],
                kind.type,
                kind.customId,
            ),
        );
        const fixture = kind.interaction({ ids: ["first", "second"] });

        await dispatcher.dispatch(fixture.interaction);

        assert.equal(run.mock.callCount(), 1, kind.name);
        const [values] = validate.mock.calls[0]?.arguments ?? [];
        assert.deepEqual(values, ["first", "second"], kind.name);
        // The schema gets a copy, so it cannot change the interaction.
        assert.notEqual(values, fixture.interaction.values, kind.name);
    }
});

test("an empty selection reaches the schema as an empty array", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const validate = mock.fn(values => ({ value: values }));
    const run = mock.fn<Run>(async () => {});
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            { schema: schema(validate) },
            run,
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(selection([]).interaction);

    assert.deepEqual(validate.mock.calls[0]?.arguments[0], []);
    assert.deepEqual(run.mock.calls[0]?.arguments[0].input, [null, []]);
});

test("schema issues reach the handler and skip the resolver", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const issues = [{ message: "Pick one priority." }];
    const resolve = mock.fn(async () => null);
    const run = mock.fn<Run>(async ctx => {
        assert.deepEqual(ctx.input, [issues, undefined]);
        await ctx.interaction.reply("Try again");
    });
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            { schema: schema(() => ({ issues })), resolve },
            run,
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(selection().interaction);

    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 1);
    assert.equal(
        records.find(record => record.event === "select-menu.completed")?.event,
        "select-menu.completed",
    );
});

test("guard rejection skips deferral, schema, and resolver", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const validate = mock.fn(values => ({ value: values }));
    const resolve = mock.fn(async () => null);
    const run = mock.fn<Run>(async () => {});
    client.selectMenus.set(
        "todo.priority",
        inputMenu({ defer: "update", schema: schema(validate), resolve }, run, [
            check(() => false),
        ]) as unknown as AnySelectMenuHandler,
    );
    const fixture = selection();

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferUpdate.mock.callCount(), 0);
    assert.equal(validate.mock.callCount(), 0);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 0);
});

test("resolver failures skip the handler and report the input stage", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const run = mock.fn<Run>(async () => {});
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            {
                schema: schema(values => ({ value: values })),
                resolve: async () => {
                    throw new Error("Lookup failed");
                },
            },
            run,
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(selection().interaction);

    assert.equal(run.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "select-menu.failed")?.stage,
        "input",
    );
});

test('defer: "update" acknowledges with deferUpdate() before the schema', async t => {
    const { client, dispatcher } = await createTestClient(t);
    const fixture = selection();
    const run = mock.fn<Run>(async ctx => {
        await ctx.interaction.editReply({ content: "Updated" });
    });
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            {
                defer: "update",
                schema: schema(values => {
                    assert.equal(fixture.interaction.deferred, true);

                    return { value: values };
                }),
            },
            run,
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferUpdate.mock.callCount(), 1);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 1);
});

test("deferral leaves an interaction a guard already acknowledged alone", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const fixture = selection();
    const run = mock.fn<Run>(async () => {});
    client.selectMenus.set(
        "todo.priority",
        inputMenu(
            { defer: "update", schema: schema(values => ({ value: values })) },
            run,
            [
                check(async ctx => {
                    await ctx.interaction.deferReply();

                    return true;
                }),
            ],
        ) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferUpdate.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 1);
});

test("params reach guards and resolvers; input reaches only the handler", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const seen: string[] = [];
    type ParamsSpec = {
        params: typeof pick;
        input: SelectMenuInputDefinition;
    };
    const run = mock.fn(async (ctx: SelectMenuContext<ParamsSpec>) => {
        assert.deepEqual(ctx.params, [null, { owner: "caller" }]);
        assert.deepEqual(ctx.input, [null, "resolved"]);
    });
    client.selectMenus.routes.set(
        pick.id,
        defineSelectMenu({
            componentType: ComponentType.StringSelect,
            params: pick,
            input: {
                schema: schema(values => ({ value: values })),
                resolve: (_value: unknown, ctx: SelectMenuContext) => {
                    assert.ok("params" in ctx);
                    seen.push("resolve");

                    return "resolved";
                },
            },
            guards: [
                ctx => {
                    assert.deepEqual(ctx.params, [null, { owner: "caller" }]);
                    seen.push("guard");

                    return check(() => true);
                },
            ],
            run: ctx => {
                return run(ctx);
            },
        }) as unknown as AnySelectMenuHandler,
    );

    await dispatcher.dispatch(
        createSelectInteraction(ComponentType.StringSelect, {
            customId: pick({ owner: "caller" }),
            values: ["high"],
        }).interaction,
    );

    assert.deepEqual(seen, ["guard", "resolve"]);
    assert.equal(run.mock.callCount(), 1);
});

test("defineSelectMenu rejects invalid input configuration", () => {
    const valid = schema(() => {
        throw new Error("Must not execute");
    });
    const cases: [unknown, RegExp][] = [
        [null, /schema configuration/],
        [{}, /Standard Schema/],
        [{ schema: valid, defer: "later" }, /boolean or "update"/],
        [{ schema: valid, resolve: 42 }, /function/],
    ];
    for (const [input, expected] of cases) {
        assert.throws(
            () => inputMenu(input as SelectMenuInputDefinition, async () => {}),
            expected,
        );
    }
});

const updateModal = (execute: () => Promise<void>) =>
    defineModal({
        customId: "todo.rename",
        input: {
            defer: "update",
            schema: schema(values => ({ value: values })),
        },
        run: () => execute(),
    });

test('modals opened from a message can defer: "update"', async t => {
    const { client, dispatcher } = await createTestClient(t);
    const run = mock.fn(async () => {});
    client.modals.set("todo.rename", updateModal(run));
    const fixture = createModalInteraction({
        customId: "todo.rename",
        message: { id: "message" },
        components: { data: [] },
    });

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferUpdate.mock.callCount(), 1);
    assert.equal(run.mock.callCount(), 1);
});

test('modals not opened from a message fail defer: "update" at the input stage', async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const run = mock.fn(async () => {});
    client.modals.set("todo.rename", updateModal(run));
    const fixture = createModalInteraction({
        customId: "todo.rename",
        components: { data: [] },
    });

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferUpdate.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "modal.failed")?.stage,
        "input",
    );
});
