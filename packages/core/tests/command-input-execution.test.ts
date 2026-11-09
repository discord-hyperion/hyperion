import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
    ApplicationCommandOptionType,
    Attachment,
    Collection,
    type CommandInteractionOption,
    MessageFlags,
} from "discord.js";
import {
    createAutocompleteInteraction,
    createChatInputInteraction,
} from "../../../tests/fixtures/interactions.ts";
import {
    type CommandContext,
    type CommandInputOptions,
    type CommandInputResult,
    type CommandInputSchema,
    defineCommand,
    defineGuard,
    defineInput,
    type GuardProvider,
} from "../src/index.ts";
import { createTempRoot } from "./support/temp-root.ts";
import { createTestClient } from "./support/test-client.ts";

const check = (
    predicate: (ctx: CommandContext) => boolean | Promise<boolean>,
) =>
    defineGuard({
        name: "Check",
        description: "Denied",
        run: (ctx: CommandContext) => {
            return predicate(ctx);
        },
    });

const inputCommand = (
    options: CommandInputOptions,
    execute: (ctx: CommandContext<CommandInputOptions>) => Promise<void>,
    builder = new ChatInputCommandBuilder()
        .setName("test")
        .setDescription("Test")
        .addStringOptions(option =>
            option.setName("todo").setDescription("Todo"),
        ),
    guards: readonly GuardProvider[] = [],
) =>
    defineCommand({
        builder,
        guards,
        // An erased definition stands in for whatever input a case tests.
        input: options as never,
        run: ctx =>
            execute(ctx as unknown as CommandContext<CommandInputOptions>),
    });

const schema = (
    validate: StandardSchemaV1["~standard"]["validate"],
): CommandInputSchema => ({
    "~standard": { version: 1, vendor: "test", validate },
});

const interaction = (values: CommandInteractionOption[] = []) => {
    const options = new Collection(values.map(value => [value.name, value]));

    return createChatInputInteraction({
        commandName: "test",
        options: { get: name => options.get(name) ?? null },
    });
};

const todoOption = (value: string): CommandInteractionOption => ({
    name: "todo",
    type: ApplicationCommandOptionType.String,
    value,
});

test("guards precede private deferral, async schema, whole-input resolution, and handler", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const order: string[] = [];
    const fixture = interaction([
        todoOption("a"),
        {
            name: "second",
            type: ApplicationCommandOptionType.String,
            value: "b",
        },
    ]);
    fixture.deferReply.mock.mockImplementation(async () => {
        order.push("defer");
    });
    const builder = new ChatInputCommandBuilder()
        .setName("test")
        .setDescription("Test")
        .addStringOptions(option =>
            option.setName("todo").setDescription("Todo"),
        )
        .addStringOptions(option =>
            option.setName("second").setDescription("Second"),
        )
        .addStringOptions(option =>
            option.setName("omitted").setDescription("Omitted"),
        );
    const definition = inputCommand(
        {
            defer: true,
            schema: schema(async input => {
                order.push("schema");
                assert.deepEqual(input, {
                    todo: "a",
                    second: "b",
                    omitted: undefined,
                });
                await Promise.resolve();

                return {
                    value: {
                        title: "Default",
                        todo: "a",
                        omitted: "Default option",
                    },
                };
            }),
            resolve: async (value, ctx) => {
                assert.equal("input" in ctx, false);
                assert.equal(ctx.interaction, fixture.interaction);
                assert.deepEqual(value, {
                    title: "Default",
                    todo: "a",
                    omitted: "Default option",
                });
                order.push("resolve");
                await Promise.resolve();

                return { title: "Default", todo: { id: "a" } };
            },
        },
        async ctx => {
            order.push("handler");
            assert.deepEqual(ctx.input, [
                null,
                { title: "Default", todo: { id: "a" } },
            ]);
            await ctx.interaction.editReply("Done");
        },
        builder,
        [
            check(ctx => {
                assert.equal("input" in ctx, false);
                order.push("guard");

                return true;
            }),
        ],
    );
    client.commands.set("test", definition);
    await dispatcher.dispatch(fixture.interaction);
    assert.deepEqual(order, ["guard", "defer", "schema", "resolve", "handler"]);
    assert.deepEqual(fixture.deferReply.mock.calls[0]?.arguments[0], {
        flags: MessageFlags.Ephemeral,
    });
    assert.equal(fixture.reply.mock.callCount(), 0);
    assert.equal(
        records.some(record => record.event === "command.completed"),
        true,
    );
    assert.equal(JSON.stringify(records).includes("Default"), false);
});

for (const issues of [[{ message: "Todo not found", path: ["todo"] }], []]) {
    test(`schema failure reaches the handler with ${issues.length} issues and no automatic response`, async t => {
        const { client, dispatcher, records } = await createTestClient(t);
        const run = mock.fn(
            async (ctx: CommandContext<CommandInputOptions>) => {
                assert.equal(ctx.input[0], issues);
                assert.equal(ctx.input[1], undefined);
            },
        );
        client.commands.set(
            "test",
            inputCommand(
                {
                    schema: schema(() => ({ issues })),
                    resolve: () =>
                        assert.fail("Invalid input must not resolve"),
                },
                run,
            ),
        );
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(run.mock.callCount(), 1);
        assert.equal(
            fixture.reply.mock.callCount() +
                fixture.editReply.mock.callCount() +
                fixture.deferReply.mock.callCount(),
            0,
        );
        assert.equal(
            records.some(record => record.event === "command.failed"),
            false,
        );
        assert.equal(JSON.stringify(records).includes("Todo not found"), false);
    });
}

test("a guard rejection skips deferral, resolvers, schema, and handler", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const never = () => assert.fail("Must be skipped");
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(never),
                resolve: never,
                defer: true,
            },
            async () => never(),
            undefined,
            [check(() => false)],
        ),
    );
    const fixture = interaction([todoOption("a")]);
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 1);
});

for (const phase of ["new", "deferred", "replied"] as const) {
    for (const failing of ["resolver", "schema"] as const) {
        test(`${failing} exception stops execution and uses the ${phase} error response`, async t => {
            const { client, dispatcher, records } = await createTestClient(t);
            const validate = mock.fn(() => {
                if (failing === "schema") {
                    throw new Error("Lookup failed");
                }

                return { value: null };
            });
            const run = mock.fn(async () => {});
            client.commands.set(
                "test",
                inputCommand(
                    {
                        schema: schema(validate),
                        resolve: () => {
                            if (failing === "resolver") {
                                throw new Error("Lookup failed");
                            }

                            return null;
                        },
                    },
                    run,
                ),
            );
            const fixture = interaction([todoOption("a")]);
            Object.assign(fixture.interaction, {
                deferred: phase === "deferred",
                replied: phase === "replied",
            });
            await dispatcher.dispatch(fixture.interaction);
            assert.equal(run.mock.callCount(), 0);
            assert.equal(validate.mock.callCount(), 1);
            const response =
                phase === "new"
                    ? fixture.reply
                    : phase === "deferred"
                      ? fixture.editReply
                      : fixture.followUp;
            assert.deepEqual(response.mock.calls[0]?.arguments[0], {
                content: "Something went wrong while running this command.",
                ...(phase === "deferred"
                    ? {}
                    : { flags: MessageFlags.Ephemeral }),
            });
            assert.equal(
                records.find(record => record.event === "command.failed")
                    ?.stage,
                "input",
            );
        });
    }
}

for (const phase of ["deferred", "replied"] as const) {
    test(`automatic deferral skips an interaction already ${phase} by a guard`, async t => {
        const { client, dispatcher } = await createTestClient(t);
        const run = mock.fn(async () => {});
        client.commands.set(
            "test",
            inputCommand(
                {
                    schema: schema(() => ({ value: undefined })),
                    defer: true,
                },
                run,
                undefined,
                [
                    check(async ctx => {
                        if (phase === "deferred") {
                            await ctx.interaction.deferReply();
                        } else {
                            await ctx.interaction.reply("Acknowledged");
                        }

                        return true;
                    }),
                ],
            ),
        );
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(
            fixture.deferReply.mock.callCount(),
            phase === "deferred" ? 1 : 0,
        );
        assert.equal(run.mock.callCount(), 1);
    });
}

test("failed automatic deferral stops input processing", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const validate = mock.fn(() => ({ value: null }));
    const run = mock.fn(async () => {});
    client.commands.set(
        "test",
        inputCommand({ schema: schema(validate), defer: true }, run),
    );
    const fixture = interaction();
    fixture.deferReply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(validate.mock.callCount(), 0);
    assert.equal(run.mock.callCount(), 0);
});

test("option extraction preserves falsy values, entity IDs, and resolved attachments", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const attachment: Attachment = Reflect.construct(Attachment, [
        {
            id: "1",
            filename: "file.txt",
            size: 1,
            url: "https://example.com/file",
            proxy_url: "https://example.com/file",
        },
    ]);
    const builder = new ChatInputCommandBuilder()
        .setName("test")
        .setDescription("Test")
        .addStringOptions(option =>
            option.setName("text").setDescription("Text"),
        )
        .addIntegerOptions(option =>
            option.setName("integer").setDescription("Integer"),
        )
        .addNumberOptions(option =>
            option.setName("number").setDescription("Number"),
        )
        .addBooleanOptions(option =>
            option.setName("boolean").setDescription("Boolean"),
        )
        .addUserOptions(option => option.setName("user").setDescription("User"))
        .addRoleOptions(option => option.setName("role").setDescription("Role"))
        .addChannelOptions(option =>
            option.setName("channel").setDescription("Channel"),
        )
        .addMentionableOptions(option =>
            option.setName("mentionable").setDescription("Mentionable"),
        )
        .addAttachmentOptions(option =>
            option.setName("attachment").setDescription("Attachment"),
        );
    const values = ["", 0, 0, false, "11", "22", "33", "44", "1"];
    const options = builder.toJSON(false).options?.map((option, index) => {
        const value = values[index];
        assert.ok(value !== undefined);

        return { name: option.name, type: option.type, value };
    });
    assert.ok(options);
    const fixture = interaction(options);
    Object.assign(fixture.interaction.options, {
        getAttachment: () => attachment,
    });
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(input => {
                    assert.deepEqual(input, {
                        text: "",
                        integer: 0,
                        number: 0,
                        boolean: false,
                        user: "11",
                        role: "22",
                        channel: "33",
                        mentionable: "44",
                        attachment,
                    });

                    return { value: input };
                }),
            },
            async ctx => {
                assert.equal(ctx.input[0], null);
            },
            builder,
        ),
    );
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(fixture.reply.mock.callCount(), 0);
});

test("concurrent invocations keep resolved values and handler contexts separate", async t => {
    const { client, dispatcher } = await createTestClient(t);
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    const contexts: CommandInputResult<CommandInputOptions>[] = [];
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(value => ({ value })),
                resolve: async value => {
                    assert.ok(
                        value && typeof value === "object" && "todo" in value,
                    );

                    if (value.todo === "first") {
                        await gate;
                    }

                    return { todo: value.todo };
                },
            },
            async ctx => {
                contexts.push(ctx.input);
            },
        ),
    );
    const first = dispatcher.dispatch(
        interaction([todoOption("first")]).interaction,
    );
    await dispatcher.dispatch(interaction([todoOption("second")]).interaction);
    release?.();
    await first;
    assert.deepEqual(contexts, [
        [null, { todo: "second" }],
        [null, { todo: "first" }],
    ]);
});

test("grouped subcommands run inherited guards before their own input pipeline", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const root = await createTempRoot(t, "hyperion-input-");
    const directory = path.join(root, "src/commands/[tools]/{items}");
    await mkdir(directory, { recursive: true });
    const entry = JSON.stringify(
        new URL("../src/index.ts", import.meta.url).href,
    );
    const builders = JSON.stringify(import.meta.resolve("@discordjs/builders"));
    const shared = `import { defineGuard } from ${entry}; export const order = []; export const check = (name) => defineGuard({ name: "Check", description:name, run(ctx) { if ('input' in ctx) throw Error('Early input'); order.push(this.description); return true; } });`;
    await writeFile(path.join(root, "shared.mjs"), shared);
    const sharedUrl = pathToFileURL(path.join(root, "shared.mjs")).href;
    const common = `import { check, order } from ${JSON.stringify(sharedUrl)};`;

    await writeFile(
        path.join(directory, "../index.mjs"),
        `${common} import {defineParentCommand} from ${entry}; import {ChatInputCommandBuilder} from ${builders}; export default defineParentCommand({
            builder:new ChatInputCommandBuilder().setDescription('Tools'), guards:[check('parent')],
        })`,
    );

    await writeFile(
        path.join(directory, "index.mjs"),
        `${common} import {defineSubcommandGroup} from ${entry}; import {ChatInputCommandSubcommandGroupBuilder} from ${builders}; export default defineSubcommandGroup({
            builder:new ChatInputCommandSubcommandGroupBuilder().setDescription('Items'), guards:[check('group')],
        })`,
    );

    await writeFile(
        path.join(directory, "todo.mjs"),
        `${common} import {defineSubcommand} from ${entry}; import {ChatInputCommandSubcommandBuilder} from ${builders}; export default defineSubcommand({
            builder:new ChatInputCommandSubcommandBuilder().setName('todo').setDescription('Todo').addStringOptions(o=>o.setName('todo').setDescription('ID')), guards:[check('leaf')], input:{resolve:value=>{order.push('resolver');return {todo:{id:value.todo}};}, schema:{'~standard':{version:1,vendor:'test',validate:value=>{order.push('schema');return {value};}}}},
            async run(ctx) { order.push('handler'); await ctx.interaction.reply(JSON.stringify(ctx.input)); },
        })`,
    );

    await client.commands.load(root);
    const fixture = createChatInputInteraction({
        commandName: "tools",
        options: {
            getSubcommand: () => "todo",
            getSubcommandGroup: () => "items",
            get: () => todoOption("a"),
        },
    });
    await dispatcher.dispatch(fixture.interaction);
    const { order } = await import(sharedUrl);
    assert.deepEqual(order, [
        "parent",
        "group",
        "leaf",
        "schema",
        "resolver",
        "handler",
    ]);
    assert.equal(
        fixture.reply.mock.calls[0]?.arguments[0],
        JSON.stringify([null, { todo: { id: "a" } }]),
    );
});

test("schema-free commands keep the original context and do not extract options", async t => {
    const { client, dispatcher } = await createTestClient(t);
    let guarded: CommandContext | undefined;
    const PlainCommand = defineCommand({
        builder: new ChatInputCommandBuilder()
            .setName("test")
            .setDescription("Plain"),
        guards: [
            check(ctx => {
                guarded = ctx;

                return true;
            }),
        ],
        run: async ctx => {
            assert.equal(ctx, guarded);
            assert.equal("input" in ctx, false);
            await ctx.interaction.reply("Plain");
        },
    });

    client.commands.set("test", PlainCommand);
    const fixture = createChatInputInteraction({ commandName: "test" });
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Plain");
    assert.equal(fixture.deferReply.mock.callCount(), 0);
});

test("autocomplete skips configured input processing and deferral", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const never = () => assert.fail("Autocomplete must not process input");
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(never),
                resolve: never,
                defer: true,
            },
            async () => never(),
        ),
    );
    const fixture = createAutocompleteInteraction({ commandName: "test" });
    await dispatcher.dispatch(fixture.interaction);
    assert.deepEqual(fixture.respond.mock.calls[0]?.arguments[0], []);
    assert.equal(fixture.deferReply.mock.callCount(), 0);
});

test("an async resolver rejection stops the handler after validation", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const validate = mock.fn(async () => ({ value: null }));
    const builder = new ChatInputCommandBuilder()
        .setName("test")
        .setDescription("Test")
        .addStringOptions(option =>
            option.setName("todo").setDescription("Todo"),
        )
        .addStringOptions(option =>
            option.setName("later").setDescription("Later"),
        );
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(validate),
                defer: true,
                resolve: async () => {
                    await Promise.resolve();
                    throw new Error("Unavailable");
                },
            },
            async () => assert.fail("Handler must not run"),
            builder,
        ),
    );
    const fixture = interaction([
        todoOption("a"),
        {
            name: "later",
            type: ApplicationCommandOptionType.String,
            value: "b",
        },
    ]);
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(validate.mock.callCount(), 1);
    assert.equal(fixture.editReply.mock.callCount(), 1);
    assert.equal(fixture.followUp.mock.callCount(), 0);
    assert.equal(
        records.find(record => record.event === "command.failed")?.stage,
        "input",
    );
});

test("async schema rejection uses the unexpected-error pipeline", async t => {
    const { client, dispatcher, records } = await createTestClient(t);
    const run = mock.fn(async () => {});
    client.commands.set(
        "test",
        inputCommand(
            {
                schema: schema(async () => {
                    await Promise.resolve();
                    throw new Error("Unavailable");
                }),
            },
            run,
        ),
    );
    const fixture = interaction();
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(run.mock.callCount(), 0);
    assert.equal(fixture.reply.mock.callCount(), 1);
    assert.equal(
        records.find(record => record.event === "command.failed")?.stage,
        "input",
    );
});

test("option names matching object properties remain ordinary input fields", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const builder = new ChatInputCommandBuilder()
        .setName("test")
        .setDescription("Test")
        .addStringOptions(option =>
            option.setName("constructor").setDescription("Constructor"),
        )
        .addStringOptions(option =>
            option.setName("__proto__").setDescription("Prototype"),
        );
    const run = mock.fn(async (ctx: CommandContext<CommandInputOptions>) => {
        assert.deepEqual(ctx.input, [
            null,
            Object.fromEntries([
                ["constructor", "a"],
                ["__proto__", "b"],
            ]),
        ]);
    });
    client.commands.set(
        "test",
        inputCommand({ schema: schema(value => ({ value })) }, run, builder),
    );
    const fixture = interaction([
        {
            name: "constructor",
            type: ApplicationCommandOptionType.String,
            value: "a",
        },
        {
            name: "__proto__",
            type: ApplicationCommandOptionType.String,
            value: "b",
        },
    ]);
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(run.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.callCount(), 0);
});

for (const resolved of [
    null,
    { todo: null },
    {
        todo: { id: "default", name: "Default" },
        message: "Fallback",
        overdue: false,
    },
]) {
    test(`resolver results are passed directly without a second validation: ${JSON.stringify(resolved)}`, async t => {
        const { client, dispatcher } = await createTestClient(t);
        const validate = mock.fn(() => ({
            value: { id: "missing", name: "Default name" },
        }));
        const resolve = mock.fn(async (value: unknown) => {
            assert.deepEqual(value, { id: "missing", name: "Default name" });

            return resolved;
        });
        const run = mock.fn(
            async (ctx: CommandContext<CommandInputOptions>) => {
                assert.equal(ctx.input[0], null);
                assert.equal(ctx.input[1], resolved);
            },
        );
        client.commands.set(
            "test",
            inputCommand({ schema: schema(validate), resolve }, run),
        );
        const fixture = interaction();
        await dispatcher.dispatch(fixture.interaction);
        assert.equal(validate.mock.callCount(), 1);
        assert.equal(resolve.mock.callCount(), 1);
        assert.equal(run.mock.callCount(), 1);
        assert.equal(fixture.reply.mock.callCount(), 0);
    });
}

test("defineInput infers a concrete handler's output without running callbacks during definition", async t => {
    const { client, dispatcher } = await createTestClient(t);
    const validate = mock.fn((value: unknown) => {
        assert.ok(value && typeof value === "object" && "todo" in value);
        assert.equal(typeof value.todo, "string");
        assert.ok(typeof value.todo === "string");

        return { value: { id: value.todo.trim() } };
    });
    const typedSchema: StandardSchemaV1<unknown, { id: string }> = {
        "~standard": { version: 1, vendor: "test", validate },
    };
    const resolve = mock.fn(
        async ({ id }: { id: string }, ctx: CommandContext) => ({
            todo: { id, name: ctx.interaction.user.id },
            message: `Loaded ${id}`,
        }),
    );
    const input = defineInput({ schema: typedSchema, defer: true, resolve });

    const DefinedCommand = defineCommand({
        builder: new ChatInputCommandBuilder()
            .setName("test")
            .setDescription("Test")
            .addStringOptions(option =>
                option.setName("todo").setDescription("Todo"),
            ),
        input,
        run: async ctx => {
            const [issues, value] = ctx.input;
            assert.equal(issues, null);
            if (issues) return;
            assert.equal(value.todo.id, "a");
            await ctx.interaction.editReply(value.message);
        },
    });

    client.commands.set("test", DefinedCommand);
    assert.equal(validate.mock.callCount(), 0);
    assert.equal(resolve.mock.callCount(), 0);
    const fixture = interaction([todoOption(" a ")]);
    await dispatcher.dispatch(fixture.interaction);
    assert.equal(validate.mock.callCount(), 1);
    assert.equal(resolve.mock.callCount(), 1);
    assert.equal(fixture.editReply.mock.calls[0]?.arguments[0], "Loaded a");
});
