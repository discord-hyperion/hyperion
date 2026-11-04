import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { describe, mock, test } from "node:test";
import {
    LabelBuilder,
    ModalBuilder,
    PrimaryButtonBuilder,
    TextInputBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import {
    ComponentType,
    MessageFlags,
    type ModalComponentResolver,
} from "discord.js";
import * as v from "valibot";
import {
    createButtonInteraction,
    createModalInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";
import {
    ButtonHandler,
    defineParams,
    type ModalContext,
    ModalHandler,
    SelectMenuHandler,
} from "../src/components/index.ts";
import { defineGuard, type Guard, paramOwner } from "../src/guards/index.ts";
import { defineInput } from "../src/index.ts";
import {
    ButtonRegistry,
    ModalRegistry,
    SelectMenuRegistry,
} from "../src/registries/index.ts";
import { modalKind } from "./support/component-kinds.ts";
import { createHandlerRoot, writeHandler } from "./support/temp-root.ts";
import { createTestClient } from "./support/test-client.ts";

const rename = defineParams({
    id: "ticket.rename",
    keys: ["ticketId", "owner"],
    schema: v.object({
        ticketId: v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/)),
        owner: v.string(),
    }),
});
const input = defineInput({
    schema: v.object({ title: v.pipe(v.string(), v.minLength(1)) }),
});

type RenameContext = ModalContext<{
    input: typeof input;
    params: typeof rename;
}>;
type Run = (ctx: RenameContext) => Promise<void>;

const form = () =>
    new ModalBuilder()
        .setTitle("Rename ticket")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Title")
                .setTextInputComponent(
                    new TextInputBuilder().setCustomId("title").setStyle(1),
                ),
        );

const createRenameModal = (
    execute: Run,
    guards: readonly Guard<ModalContext<{ params: typeof rename }>>[] = [],
    options: {
        resolve?: (value: { title: string }, ctx: never) => unknown;
    } = {},
) =>
    new (class extends ModalHandler<{
        input: typeof input;
        params: typeof rename;
    }> {
        constructor() {
            super({
                params: rename,
                builder: form(),
                input: { ...input, ...options } as typeof input,
                guards,
            });
        }

        run(ctx: RenameContext) {
            return execute(ctx);
        }
    })() as unknown as ModalHandler;

type Submitted = ModalComponentResolver["data"][number];
const submission = (customId: string, title = "New title", user = "author") =>
    createModalInteraction({
        customId,
        user: { id: user },
        components: {
            data: [
                {
                    id: 1,
                    type: ComponentType.Label,
                    component: {
                        id: 2,
                        type: ComponentType.TextInput,
                        customId: "title",
                        value: title,
                    },
                } satisfies Submitted,
            ],
        },
    });

const ticket = { ticketId: "a1b2c3d4", owner: "author" };

describe("modal params dispatch", () => {
    test("guards see params, then input runs and the handler sees both", async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const order: string[] = [];
        const seesParams = () =>
            defineGuard<ModalContext<{ params: typeof rename }>>({
                name: "SeesParams",
                description: "Denied",
                run(ctx: ModalContext<{ params: typeof rename }>) {
                    order.push("guard");
                    assert.deepEqual(ctx.params, [null, ticket]);
                    assert.equal("input" in ctx, false);

                    return true;
                },
            });
        const execute = mock.fn<Run>(async ctx => {
            order.push("handler");
            assert.deepEqual(ctx.params, [null, ticket]);
            assert.deepEqual(ctx.input, [null, { title: "New title" }]);
        });
        client.modals.routes.set(
            rename.id,
            createRenameModal(execute, [seesParams()]),
        );
        const fixture = submission(rename(ticket));
        await dispatcher.dispatch(fixture.interaction);

        assert.deepEqual(order, ["guard", "handler"]);
        assert.ok(records.find(record => record.event === "modal.completed"));
        assert.ok(!JSON.stringify(records).includes("a1b2c3d4"));
    });

    test("an input resolver receives the params-bearing context", async t => {
        const { client, dispatcher } = await createTestClient(t);
        const seen: unknown[] = [];
        const execute = mock.fn<Run>(async ctx => {
            assert.deepEqual(ctx.input, [null, "resolved"]);
        });
        client.modals.routes.set(
            rename.id,
            createRenameModal(execute, [], {
                resolve: (_value, ctx: never) => {
                    seen.push((ctx as RenameContext).params);

                    return "resolved";
                },
            }),
        );
        await dispatcher.dispatch(submission(rename(ticket)).interaction);

        assert.deepEqual(seen, [[null, ticket]]);
        assert.equal(execute.mock.callCount(), 1);
    });

    test("invalid params still run input, and the handler gets both tuples", async t => {
        const { client, dispatcher } = await createTestClient(t);
        const execute = mock.fn<Run>(async ctx => {
            const [paramIssues, params] = ctx.params;
            assert.ok(paramIssues);
            assert.equal(params, undefined);
            assert.deepEqual(ctx.input, [null, { title: "New title" }]);
        });
        client.modals.routes.set(rename.id, createRenameModal(execute));

        await dispatcher.dispatch(
            submission(rename({ ticketId: "NOT-VALID", owner: "author" }))
                .interaction,
        );

        assert.equal(execute.mock.callCount(), 1);
    });

    test("paramOwner rejects another user before input runs", async t => {
        const { client, dispatcher } = await createTestClient(t);
        const execute = mock.fn<Run>(async () => {});
        client.modals.routes.set(
            rename.id,
            createRenameModal(execute, [
                paramOwner("owner", "Only the author can rename it."),
            ]),
        );
        const fixture = submission(rename(ticket), "Hijack", "intruder");
        await dispatcher.dispatch(fixture.interaction);

        assert.equal(execute.mock.callCount(), 0);
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content: "Only the author can rename it.",
            flags: MessageFlags.Ephemeral,
        });
    });

    test("literal IDs win, and wrong segment counts stay unmatched with a debug log", async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const execute = mock.fn<Run>(async () => {});
        client.modals.routes.set(rename.id, createRenameModal(execute));

        for (const customId of ["ticket.rename", "ticket.rename:a1b2c3d4"]) {
            const fixture = submission(customId);
            await dispatcher.dispatch(fixture.interaction);
            assert.equal(fixture.reply.mock.callCount(), 0);
        }

        assert.equal(execute.mock.callCount(), 0);
        const logged = records.filter(
            record => record.event === "modal.params.undecodable",
        );
        assert.deepEqual(
            logged.map(({ route, segments, expected }) => ({
                route,
                segments,
                expected,
            })),
            [
                { route: "ticket.rename", segments: 0, expected: 2 },
                { route: "ticket.rename", segments: 1, expected: 2 },
            ],
        );
        assert.ok(!JSON.stringify(logged).includes("a1b2c3d4"));
    });
});

describe("undecodable routes log for every kind", () => {
    const pick = defineParams({
        id: "pick",
        keys: ["owner"],
        schema: v.object({ owner: v.string() }),
    });

    test("buttons and select menus", async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        client.buttons.routes.set(
            pick.id,
            new (class extends ButtonHandler<{ params: typeof pick }> {
                constructor() {
                    super({ params: pick });
                }
                async run() {}
            })() as unknown as ButtonHandler,
        );
        client.selectMenus.routes.set(
            pick.id,
            new (class extends SelectMenuHandler<{
                componentType: ComponentType.UserSelect;
                params: typeof pick;
            }> {
                constructor() {
                    super({
                        componentType: ComponentType.UserSelect,
                        params: pick,
                    });
                }
                async run() {}
            })() as never,
        );

        await dispatcher.dispatch(
            createButtonInteraction({ customId: "pick" }).interaction,
        );

        await dispatcher.dispatch(
            createSelectInteraction(ComponentType.UserSelect, {
                customId: "pick:a:b",
            }).interaction,
        );

        assert.deepEqual(
            records
                .filter(record =>
                    String(record.event).endsWith(".params.undecodable"),
                )
                .map(({ event, segments }) => ({ event, segments })),
            [
                { event: "button.params.undecodable", segments: 0 },
                { event: "select-menu.params.undecodable", segments: 2 },
            ],
        );
    });
});

describe("modal params loading", () => {
    const source = (body: string) => `
        import { ModalHandler, defineParams } from ${JSON.stringify(new URL("../src/components/index.ts", import.meta.url).href)};
        import { ModalBuilder, LabelBuilder, TextInputBuilder } from ${JSON.stringify(import.meta.resolve("@discordjs/builders"))};
        const params = defineParams({ id: "a.route", keys: [], schema: { "~standard": { version: 1, vendor: "test", validate: value => ({ value }) } } });
        export default class extends ModalHandler {
            constructor() { super(${body}); }
            async run() {}
        }
    `;

    test("routes load into routes, and collisions and mismatched templates fail", async t => {
        const { root, directory } = await createHandlerRoot(
            t,
            "hyperion-modal-params-",
            "modals",
        );

        const registry = new ModalRegistry();
        const params = await writeHandler(directory, source("{ params }"));
        await registry.load(root);
        const original = registry.routes.get("a.route");

        assert.ok(original);
        assert.equal(registry.size, 0);

        const cases: [string, string, RegExp][] = [
            [
                "duplicate",
                source("{ params }"),
                /Duplicate modal route "a\.route"/,
            ],
            [
                "literal",
                modalKind.source("a.route"),
                /Modal route "a\.route" collides with a literal custom ID/,
            ],
        ];

        for (const [name, contents, error] of cases) {
            const file = await writeHandler(directory, contents, name);

            await assert.rejects(registry.load(root), error);
            assert.equal(registry.routes.get("a.route"), original);

            await rm(file);
        }

        await rm(params);

        await writeHandler(
            directory,
            source(
                '{ params, builder: new ModalBuilder().setCustomId("other").setTitle("T").addLabelComponents(new LabelBuilder().setLabel("L").setTextInputComponent(new TextInputBuilder().setCustomId("x").setStyle(1))) }',
            ),
        );

        await assert.rejects(registry.load(root), error => {
            assert.match(
                String((error as Error).cause),
                /template custom ID must match its handler's route/,
            );

            return true;
        });
    });

    test("a modal cannot declare both a customId and params", () => {
        assert.throws(
            () =>
                new (class extends ModalHandler<{ params: typeof rename }> {
                    constructor() {
                        super({ params: rename, customId: "x" } as never);
                    }
                    async run() {}
                })(),
            /either a customId or params/,
        );
    });
});

describe("build(definition, values)", () => {
    const pick = defineParams({
        id: "pick",
        keys: ["owner"],
        schema: v.object({ owner: v.string() }),
    });
    const kinds = [
        {
            name: "button",
            registry: () => new ButtonRegistry(),
            handler: (template?: PrimaryButtonBuilder) =>
                new (class extends ButtonHandler<{ params: typeof pick }> {
                    constructor() {
                        super({
                            params: pick,
                            ...(template && { builder: template }),
                        });
                    }
                    async run() {}
                })(),
            template: () => new PrimaryButtonBuilder().setLabel("Pick"),
        },
        {
            name: "select menu",
            registry: () => new SelectMenuRegistry(),
            handler: (template?: UserSelectMenuBuilder) =>
                new (class extends SelectMenuHandler<{
                    componentType: ComponentType.UserSelect;
                    params: typeof pick;
                }> {
                    constructor() {
                        super({
                            componentType: ComponentType.UserSelect,
                            params: pick,
                            ...(template && { builder: template }),
                        });
                    }
                    async run() {}
                })(),
            template: () => new UserSelectMenuBuilder().setPlaceholder("Pick"),
        },
        {
            name: "modal",
            registry: () => new ModalRegistry(),
            handler: (template?: ModalBuilder) =>
                new (class extends ModalHandler<{ params: typeof pick }> {
                    constructor() {
                        super({
                            params: pick,
                            ...(template && { builder: template }),
                        });
                    }
                    async run() {}
                })(),
            template: form,
        },
    ] as const;

    // The kinds table is a runtime union; every registry shares this build() shape.
    const registryOf = (kind: (typeof kinds)[number]) =>
        kind.registry() as unknown as ModalRegistry;

    for (const kind of kinds) {
        test(`${kind.name}: returns a fresh copy with the encoded custom ID`, () => {
            const registry = registryOf(kind);
            const handler = kind.handler(kind.template() as never);
            registry.routes.set(pick.id, handler as never);

            const first = registry.build(pick, { owner: "a:b" });
            const second = registry.build(pick, { owner: "c" });

            assert.equal(first.toJSON().custom_id, "pick:a%3Ab");
            assert.equal(second.toJSON().custom_id, "pick:c");
            assert.equal(handler.builder?.toJSON(false).custom_id, undefined);
            assert.throws(
                () => registry.build("pick"),
                /belongs to a params handler/,
            );
        });

        test(`${kind.name}: missing handlers, other keys, and missing templates throw`, () => {
            const registry = registryOf(kind);
            const stale = defineParams({
                id: "pick",
                keys: ["user"],
                schema: v.object({ user: v.string() }),
            });

            assert.throws(
                () => registry.build(pick, { owner: "a" }),
                new RegExp(`No ${kind.name} params handler is loaded`),
            );

            registry.routes.set(pick.id, kind.handler() as never);

            assert.throws(
                () => registry.build(stale, { user: "a" }),
                /declares different keys/,
            );
            assert.throws(
                () => registry.build(pick, { owner: "a" }),
                /has no template/,
            );
        });
    }
});
