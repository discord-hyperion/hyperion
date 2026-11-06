import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mock, test } from "node:test";
import {
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
    Collection,
    ComponentType,
    MessageFlags,
    ModalComponentResolver,
} from "discord.js";
import * as v from "valibot";
import { createModalInteraction } from "../../../tests/fixtures/interactions.ts";
import {
    defineGuard,
    defineInput,
    type GuardProvider,
    type ModalContext,
    ModalHandler,
    type ModalInputOptions,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";
import { createTestClient } from "./support/test-client.ts";

type Submitted = ModalComponentResolver["data"][number];
const text = (customId: string, value = ""): Submitted => ({
    id: 1,
    type: ComponentType.Label,
    component: { id: 2, type: ComponentType.TextInput, customId, value },
});
const builder = () =>
    new ModalBuilder()
        .setCustomId("todo.create")
        .setTitle("Create todo")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Name")
                .setTextInputComponent(
                    new TextInputBuilder().setCustomId("name").setStyle(1),
                ),
        );
const schema = (
    validate: StandardSchemaV1["~standard"]["validate"],
): StandardSchemaV1 => ({
    "~standard": { version: 1, vendor: "test", validate },
});
class InputModal extends ModalHandler<{ input: ModalInputOptions }> {
    constructor(
        input: ModalInputOptions,
        private readonly execute: (
            ctx: ModalContext<{ input: ModalInputOptions }>,
        ) => Promise<void>,
        guards: readonly GuardProvider<ModalContext>[] = [],
    ) {
        super({
            builder: builder(),
            input,
            guards,
        });
    }

    run(ctx: ModalContext<{ input: ModalInputOptions }>) {
        return this.execute(ctx);
    }
}
const check = (predicate: (ctx: ModalContext) => boolean | Promise<boolean>) =>
    defineGuard<ModalContext>({
        name: "Check",
        description: "Denied",
        run(ctx: ModalContext) {
            return predicate(ctx);
        },
    });
const submission = (
    data: readonly Submitted[] = [text("name", "Private text")],
) => createModalInteraction({ customId: "todo.create", components: { data } });

test("modal guards precede private deferral, async schema, resolver, and handler", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const order: string[] = [];
    const fixture = submission();
    const originalContexts: ModalContext[] = [];
    const input = {
        defer: true,
        schema: schema(async values => {
            order.push("schema");
            assert.equal(fixture.interaction.deferred, true);
            assert.deepEqual(values, { name: "Private text" });

            return { value: { normalized: true } };
        }),
        resolve: async (values: unknown, ctx: ModalContext) => {
            order.push("resolve");
            assert.deepEqual(values, { normalized: true });
            assert.equal("input" in ctx, false);
            originalContexts.push(ctx);

            return { todo: { id: "created" } };
        },
    };
    client.modals.set(
        "todo.create",
        new InputModal(
            input,
            async ctx => {
                order.push("handler");
                assert.notEqual(ctx, originalContexts[0]);
                assert.equal(ctx.interaction, fixture.interaction);
                assert.deepEqual(ctx.input, [
                    null,
                    { todo: { id: "created" } },
                ]);
                await ctx.interaction.editReply("Created");
            },
            [
                check(ctx => {
                    order.push("guard");
                    assert.equal(ctx.interaction.deferred, false);
                    assert.equal("input" in ctx, false);
                    originalContexts.push(ctx);

                    return true;
                }),
            ],
        ),
    );

    await dispatcher.dispatch(fixture.interaction);

    assert.deepEqual(order, ["guard", "schema", "resolve", "handler"]);
    assert.equal(
        originalContexts[0]?.interaction,
        originalContexts[1]?.interaction,
    );
    assert.equal(originalContexts[0]?.logger, originalContexts[1]?.logger);
    assert.deepEqual(fixture.deferReply.mock.calls[0]?.arguments[0], {
        flags: MessageFlags.Ephemeral,
    });
    assert.equal(fixture.editReply.mock.callCount(), 1);
    assert.ok(!JSON.stringify(records).includes("Private text"));
});

test("extracts submitted labels/legacy rows, preserves literal keys and empties, and ignores text displays", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const data: Submitted[] = [
        text("todo.name", ""),
        text("__proto__", "safe"),
        text("constructor", "ordinary"),
        {
            id: 3,
            type: ComponentType.ActionRow,
            components: [
                {
                    id: 4,
                    type: ComponentType.TextInput,
                    customId: "extra",
                    value: "personalized",
                },
            ],
        },
        { id: 5, type: ComponentType.TextDisplay },
        {
            id: 6,
            type: ComponentType.Label,
            component: {
                id: 7,
                type: ComponentType.StringSelect,
                customId: "choice",
                values: ["a"],
            },
        },
        {
            id: 8,
            type: ComponentType.Label,
            component: {
                id: 9,
                type: ComponentType.FileUpload,
                customId: "file",
                values: [],
                attachments: new Collection(),
            },
        },
    ];
    const validate = mock.fn(values => {
        assert.deepEqual(
            values,
            Object.fromEntries([
                ["todo.name", ""],
                ["__proto__", "safe"],
                ["constructor", "ordinary"],
                ["extra", "personalized"],
                ["choice", ["a"]],
                ["file", []],
            ]),
        );
        assert.equal(Object.getPrototypeOf(values), Object.prototype);
        assert.equal(Object.hasOwn(values, "name"), false);

        return { value: values };
    });
    const run = mock.fn(async () => {});
    client.modals.set(
        "todo.create",
        new InputModal({ schema: schema(validate) }, run),
    );

    await dispatcher.dispatch(submission(data).interaction);

    assert.equal(validate.mock.callCount(), 1);
    assert.equal(run.mock.callCount(), 1);
});

const control = (component: Record<string, unknown>, id = 20): Submitted =>
    ({
        id,
        type: ComponentType.Label,
        component: { id: id + 1, ...component },
    }) as unknown as Submitted;
const attachment = (id: string) => ({ id, name: `${id}.png`, size: 10 });

test("extracts every modal control with its value shape", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const files = [attachment("f2"), attachment("f1")];
    const data: Submitted[] = [
        text("name", "Todo"),
        control({
            type: ComponentType.StringSelect,
            customId: "priority",
            values: ["high"],
        }),
        control({
            type: ComponentType.UserSelect,
            customId: "assignee",
            values: ["100"],
            users: new Collection(),
        }),
        control({
            type: ComponentType.RoleSelect,
            customId: "roles",
            values: [],
        }),
        control({
            type: ComponentType.MentionableSelect,
            customId: "notify",
            values: ["200", "300"],
        }),
        control({
            type: ComponentType.ChannelSelect,
            customId: "channel",
            values: ["400"],
        }),
        control({
            type: ComponentType.FileUpload,
            customId: "files",
            // Order follows `values`, not the collection.
            values: ["f1", "f2"],
            attachments: new Collection(files.map(file => [file.id, file])),
        }),
        control({
            type: ComponentType.RadioGroup,
            customId: "size",
            value: null,
        }),
        control({
            type: ComponentType.CheckboxGroup,
            customId: "tags",
            values: ["bug"],
        }),
        control({
            type: ComponentType.Checkbox,
            customId: "urgent",
            value: false,
        }),
    ];
    const validate = mock.fn(values => {
        assert.deepEqual(values, {
            name: "Todo",
            priority: ["high"],
            assignee: ["100"],
            roles: [],
            notify: ["200", "300"],
            channel: ["400"],
            files: [files[1], files[0]],
            size: null,
            tags: ["bug"],
            urgent: false,
        });

        return { value: values };
    });
    const run = mock.fn(async () => {});
    client.modals.set(
        "todo.create",
        new InputModal({ schema: schema(validate) }, run),
    );

    await dispatcher.dispatch(submission(data).interaction);

    assert.equal(validate.mock.callCount(), 1);
    assert.equal(run.mock.callCount(), 1);
});

for (const [name, component] of [
    [
        "select without a string array",
        { type: ComponentType.UserSelect, values: "Private value" },
    ],
    [
        "checkbox group with a non-string value",
        { type: ComponentType.CheckboxGroup, values: [42] },
    ],
    [
        "file upload missing an attachment",
        {
            type: ComponentType.FileUpload,
            values: ["Private value"],
            attachments: new Collection(),
        },
    ],
    [
        "file upload without an ID array",
        {
            type: ComponentType.FileUpload,
            values: "Private value",
            attachments: new Collection(),
        },
    ],
    [
        "radio group with a non-string value",
        { type: ComponentType.RadioGroup, value: 42 },
    ],
    [
        "checkbox with a non-boolean value",
        { type: ComponentType.Checkbox, value: "Private value" },
    ],
    [
        "duplicate custom ID across control types",
        { type: ComponentType.Checkbox, value: true, customId: "Private ID" },
    ],
] as const) {
    test(`rejects a ${name} before validation without logging values`, async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const validate = mock.fn(values => ({ value: values }));
        const run = mock.fn(async () => {});
        client.modals.set(
            "todo.create",
            new InputModal({ schema: schema(validate) }, run),
        );
        const fixture = submission([
            text("Private ID", "ok"),
            control({ customId: "other", ...component }),
        ]);

        await dispatcher.dispatch(fixture.interaction);

        assert.equal(validate.mock.callCount(), 0);
        assert.equal(run.mock.callCount(), 0);
        assert.equal(
            records.find(record => record.event === "modal.failed")?.stage,
            "input",
        );
        assert.ok(!JSON.stringify(records).includes("Private value"));
        assert.ok(!JSON.stringify(records).includes("Private ID"));
    });
}

test("schemas own missing-field defaults, trimming, and successful output without a resolver", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const input = defineInput({
        schema: v.object({
            name: v.pipe(v.string(), v.trim()),
            description: v.optional(v.string(), "Default"),
        }),
    });
    class Typed extends ModalHandler<{ input: typeof input }> {
        constructor() {
            super({ builder: builder(), input });
        }
        async run(ctx: ModalContext<{ input: typeof input }>) {
            assert.deepEqual(ctx.input, [
                null,
                { name: "Todo", description: "Default" },
            ]);
        }
    }
    client.modals.set("todo.create", new Typed());
    const fixture = submission([text("name", "  Todo  ")]);

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
});

test("schema issues reach the handler unchanged and skip resolution and automatic responses", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const issues = [{ message: "Private validation detail", path: ["name"] }];
    const resolve = mock.fn(async () => "must not run");
    const run = mock.fn(
        async (ctx: ModalContext<{ input: ModalInputOptions }>) => {
            assert.equal(ctx.input[0], issues);
            assert.equal(ctx.input[1], undefined);
        },
    );
    client.modals.set(
        "todo.create",
        new InputModal({ schema: schema(() => ({ issues })), resolve }, run),
    );
    const fixture = submission([]);

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(run.mock.callCount(), 1);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.ok(!JSON.stringify(records).includes("Private validation detail"));
});

for (const phase of ["schema", "resolve"] as const) {
    test(`modal ${phase} exceptions use the input error stage and skip the handler`, async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const run = mock.fn(async () => {});
        const failure = new Error("Application failure");
        client.modals.set(
            "todo.create",
            new InputModal(
                {
                    defer: true,
                    schema: schema(async values => {
                        if (phase === "schema") {
                            throw failure;
                        }

                        return { value: values };
                    }),
                    resolve: async () => {
                        throw failure;
                    },
                },
                run,
            ),
        );
        const fixture = submission();

        await dispatcher.dispatch(fixture.interaction);

        assert.equal(run.mock.callCount(), 0);
        assert.equal(fixture.editReply.mock.callCount(), 1);
        assert.equal(
            records.find(record => record.event === "modal.failed")?.stage,
            "input",
        );
    });
}

for (const kind of ["duplicate", "missing", "null", "number"] as const) {
    test(`rejects ${kind} text-input data before validation without logging values`, async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const validate = mock.fn(values => ({ value: values }));
        const run = mock.fn(async () => {});
        client.modals.set(
            "todo.create",
            new InputModal({ schema: schema(validate) }, run),
        );
        const control = text("Private ID", "Private value");
        assert.equal(control.type, ComponentType.Label);

        if (control.type !== ComponentType.Label) {
            throw new Error("Fixture must be a label");
        }

        if (kind !== "duplicate") {
            if (kind === "missing") {
                Reflect.deleteProperty(control.component, "value");
            } else {
                Reflect.set(
                    control.component,
                    "value",
                    kind === "null" ? null : 42,
                );
            }
        }

        const data = kind === "duplicate" ? [control, control] : [control];
        // Exercise the SDK's real hoisting behavior, including silent overwrite.
        const resolver: ModalComponentResolver = Reflect.construct(
            ModalComponentResolver,
            [client, data],
        );
        assert.equal(resolver.hoistedComponents.size, 1);
        const fixture = submission(resolver.data);

        await dispatcher.dispatch(fixture.interaction);

        assert.equal(validate.mock.callCount(), 0);
        assert.equal(run.mock.callCount(), 0);
        assert.equal(fixture.reply.mock.callCount(), 1);
        assert.equal(
            records.find(record => record.event === "modal.failed")?.stage,
            "input",
        );
        assert.ok(!JSON.stringify(records).includes("Private value"));
        assert.ok(!JSON.stringify(records).includes("Private ID"));
    });
}

test("guard rejection skips extraction, deferral, schemas, and resolvers", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const validate = mock.fn(values => ({ value: values }));
    const resolve = mock.fn(async () => null);
    const run = mock.fn(async () => {});
    client.modals.set(
        "todo.create",
        new InputModal(
            { defer: true, schema: schema(validate), resolve },
            run,
            [check(() => false)],
        ),
    );
    const fixture = submission([text("same"), text("same")]);

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(validate.mock.callCount(), 0);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 0);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
});

for (const acknowledgment of ["reply", "deferReply", "deferUpdate"] as const) {
    test(`preserves ${acknowledgment} from a guard and uses the correct error response`, async t => {
        const { client, dispatcher } = await createTestClient(t);
        client.modals.set(
            "todo.create",
            new InputModal({
                defer: true,
                schema: schema(() => {
                    throw new Error("Failure");
                }),
            }, async () => {}, [
                check(async ctx => {
                    if (acknowledgment === "reply") {
                        await ctx.interaction.reply("Acknowledged");
                    } else if (acknowledgment === "deferReply") {
                        await ctx.interaction.deferReply({
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        await ctx.interaction.deferUpdate();
                    }

                    return true;
                }),
            ]),
        );
        const fixture = submission();

        await dispatcher.dispatch(fixture.interaction);

        assert.equal(
            fixture.deferReply.mock.callCount(),
            acknowledgment === "deferReply" ? 1 : 0,
        );
        assert.equal(
            fixture.editReply.mock.callCount(),
            acknowledgment === "deferReply" ? 1 : 0,
        );
        assert.equal(
            fixture.followUp.mock.callCount(),
            acknowledgment === "deferReply" ? 0 : 1,
        );
    });
}

test("configuration is snapshotted while schemas remain shared and invocation inputs are fresh", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const contexts: ModalContext<{ input: ModalInputOptions }>[] = [];
    const originalSchema = schema(values => ({ value: values }));
    const options = { schema: originalSchema, defer: false };
    const modal = new InputModal(options, async ctx => {
        contexts.push(ctx);
    });
    options.defer = true;
    assert.equal(Object.isFrozen(modal.input), true);
    assert.equal(Object.isFrozen(originalSchema), false);
    assert.equal(modal.input?.schema, originalSchema);
    client.modals.set("todo.create", modal);

    await Promise.all([
        dispatcher.dispatch(submission([text("name", "first")]).interaction),
        dispatcher.dispatch(submission([text("name", "second")]).interaction),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.deepEqual(
        contexts.map(ctx => ctx.input[1]),
        [{ name: "first" }, { name: "second" }],
    );
    assert.equal(modal.input?.defer, false);
});

test("modal discovery does not execute schemas or resolvers and failed reload preserves definitions", async t => {
    const { client } = await createTestClient(t);
    const root = await createTempRoot(t, "hyperion-modal-input-");
    const directory = path.join(root, "src/modals");
    await mkdir(directory, { recursive: true });
    const core = new URL("../src/index.ts", import.meta.url).href;
    const builders = import.meta.resolve("@discordjs/builders");

    await writeFile(
        path.join(directory, "valid.mjs"),
        `
        import { ModalHandler } from ${JSON.stringify(core)};
        import { ModalBuilder, TextDisplayBuilder } from ${JSON.stringify(builders)};
        export default class extends ModalHandler {
            constructor() { super({ builder: new ModalBuilder().setCustomId('registered').setTitle('Form').addTextDisplayComponents(new TextDisplayBuilder().setContent('Info')),
                input: { schema: { '~standard': { version: 1, validate() { throw new Error('Must not execute'); } } }, resolve() { throw new Error('Must not execute'); } }
            }); }
            async run() {}
        }
    `,
    );

    await client.modals.load(root);
    const previous = client.modals.get("registered");
    assert.ok(previous);

    await writeFile(
        path.join(directory, "invalid.mjs"),
        `
        import { ModalHandler } from ${JSON.stringify(core)};
        import { ModalBuilder } from ${JSON.stringify(builders)};
        export default class extends ModalHandler {
            constructor() { super({ builder: new ModalBuilder().setCustomId('invalid'), input: { schema: {} } }); }
            async run() {}
        }
    `,
    );

    await assert.rejects(client.modals.load(root), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /invalid.mjs/);
        assert.ok(error.cause instanceof TypeError);
        assert.match(error.cause.message, /Standard Schema/);

        return true;
    });

    assert.equal(client.modals.size, 1);
    assert.equal(client.modals.get("registered"), previous);
});

test("failed modal deferral skips extraction, schema, resolver, and handler", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const validate = mock.fn(values => ({ value: values }));
    const resolve = mock.fn(async () => null);
    const run = mock.fn(async () => {});
    client.modals.set(
        "todo.create",
        new InputModal({ defer: true, schema: schema(validate), resolve }, run),
    );
    const fixture = submission([text("same"), text("same")]);
    fixture.deferReply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });

    await dispatcher.dispatch(fixture.interaction);

    assert.equal(validate.mock.callCount(), 0);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "modal.failed")?.stage,
        "input",
    );
});

test("modal constructors reject invalid input configuration without executing application code", () => {
    const valid = schema(() => {
        throw new Error("Must not execute");
    });
    const cases: [unknown, RegExp][] = [
        [null, /schema configuration/],
        [{}, /Standard Schema/],
        [{ schema: valid, defer: "yes" }, /boolean/],
        [{ schema: valid, resolve: 42 }, /function/],
        [{ schema: valid, resolvers: {} }, /input.resolve/],
    ];
    for (const [input, expected] of cases) {
        assert.throws(
            () => Reflect.construct(InputModal, [input, async () => {}]),
            expected,
        );
    }
});
