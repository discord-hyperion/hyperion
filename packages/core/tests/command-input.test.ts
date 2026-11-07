import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import {
    type CommandInputOptions,
    type CommandInputSchema,
    defineCommand,
    defineSubcommand,
} from "../src/index.ts";

const schema: CommandInputSchema = {
    "~standard": {
        version: 1,
        vendor: "test",
        validate: () => {
            throw new Error("Must not validate during construction");
        },
    },
};

type Input = CommandInputOptions<typeof schema>;

const handlers = [
    [
        "defineCommand",
        (input: Input) =>
            defineCommand({
                builder: new ChatInputCommandBuilder()
                    .setName("todo")
                    .setDescription("Todo")
                    .addStringOptions(option =>
                        option.setName("todo").setDescription("ID"),
                    ),
                input,
                run() {},
            }),
    ],
    [
        "defineSubcommand",
        (input: Input) =>
            defineSubcommand({
                builder: new ChatInputCommandSubcommandBuilder()
                    .setName("todo")
                    .setDescription("Todo")
                    .addStringOptions(option =>
                        option.setName("todo").setDescription("ID"),
                    ),
                input,
                run() {},
            }),
    ],
] as const;

for (const [name, define] of handlers) {
    test(`${name} retains shared schema and snapshots a lazy resolver`, () => {
        const resolver = (_value: unknown) => {
            throw new Error("Must not resolve during construction");
        };
        const input = {
            schema,
            resolve: resolver,
            defer: true,
        };
        const handler = define(input);
        assert.notEqual(handler.input, input);
        assert.equal(Object.isFrozen(handler.input), true);
        assert.equal(handler.input?.schema, schema);
        assert.equal(handler.input?.defer, true);
        assert.equal(handler.input?.resolve, resolver);
        input.defer = false;
        input.resolve = () => {
            throw new Error("Replacement must not be used");
        };
        assert.equal(handler.input?.defer, true);
        assert.equal(handler.input?.resolve, resolver);
        assert.equal(define({ schema }).input?.defer, false);
        assert.equal(define({ schema, defer: false }).input?.defer, false);
    });

    test(`${name} rejects invalid and legacy resolver configuration`, () => {
        assert.throws(
            () =>
                define({
                    schema,
                    // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                    resolve: 42,
                }),
            /must be a function/,
        );
        assert.throws(
            () =>
                define({
                    schema,
                    // @ts-expect-error The per-option resolver API has been removed.
                    resolvers: { todo: () => null },
                }),
            /Use input.resolve/,
        );
    });

    test(`${name} rejects incomplete input configuration`, () => {
        assert.throws(
            // @ts-expect-error Exercise runtime rejection for JavaScript callers.
            () => define({ defer: false }),
            /Standard Schema v1/,
        );
        assert.throws(
            // @ts-expect-error Exercise runtime rejection for JavaScript callers.
            () => define({ resolve: () => null }),
            /Standard Schema v1/,
        );
        assert.throws(
            () =>
                define({
                    schema,
                    // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                    defer: "private",
                }),
            /must be a boolean/,
        );
        assert.throws(
            () =>
                define({
                    schema,
                    // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                    defer: "update",
                }),
            /no message to update/,
        );
        assert.throws(
            () =>
                define({
                    schema: {
                        "~standard": {
                            // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                            version: 2,
                            validate: () => ({ value: null }),
                        },
                    },
                }),
            /Standard Schema v1/,
        );
    });
}

test("context-menu commands reject input configuration at runtime", () => {
    assert.throws(
        () =>
            defineCommand({
                builder: new UserContextCommandBuilder().setName("Inspect"),
                // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                input: { schema },
                run() {},
            }),
        /require a chat-input command/,
    );
});
