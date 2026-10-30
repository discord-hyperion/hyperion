import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import type { ApplicationCommandType } from "discord.js";
import {
    Command,
    type CommandContext,
    type CommandInputOptions,
    type CommandInputSchema,
    Subcommand,
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

class TodoCommand extends Command<CommandInputOptions<typeof schema>> {
    constructor(options: CommandInputOptions<typeof schema>) {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("todo")
                .setDescription("Todo")
                .addStringOptions(option =>
                    option.setName("todo").setDescription("ID"),
                ),
            input: options,
        });
    }

    async run(_ctx: CommandContext<CommandInputOptions<typeof schema>>) {}
}

class TodoSubcommand extends Subcommand<CommandInputOptions<typeof schema>> {
    constructor(options: CommandInputOptions<typeof schema>) {
        super({
            builder: new ChatInputCommandSubcommandBuilder()
                .setName("todo")
                .setDescription("Todo")
                .addStringOptions(option =>
                    option.setName("todo").setDescription("ID"),
                ),
            input: options,
        });
    }

    async run(_ctx: CommandContext<CommandInputOptions<typeof schema>>) {}
}

for (const Handler of [TodoCommand, TodoSubcommand]) {
    test(`${Handler.name} retains shared schema and snapshots a lazy resolver`, () => {
        const resolver = (_value: unknown) => {
            throw new Error("Must not resolve during construction");
        };
        const input = {
            schema,
            resolve: resolver,
            defer: true,
        };
        const handler = new Handler(input);
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
        assert.equal(new Handler({ schema }).input?.defer, false);
        assert.equal(new Handler({ schema, defer: false }).input?.defer, false);
    });

    test(`${Handler.name} rejects invalid and legacy resolver configuration`, () => {
        assert.throws(
            () =>
                new Handler({
                    schema,
                    // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                    resolve: 42,
                }),
            /must be a function/,
        );
        assert.throws(
            () =>
                new Handler({
                    schema,
                    // @ts-expect-error The per-option resolver API has been removed.
                    resolvers: { todo: () => null },
                }),
            /Use input.resolve/,
        );
    });

    test(`${Handler.name} rejects incomplete input configuration`, () => {
        assert.throws(
            // @ts-expect-error Exercise runtime rejection for JavaScript callers.
            () => new Handler({ defer: false }),
            /Standard Schema v1/,
        );
        assert.throws(
            // @ts-expect-error Exercise runtime rejection for JavaScript callers.
            () => new Handler({ resolve: () => null }),
            /Standard Schema v1/,
        );
        assert.throws(
            () =>
                new Handler({
                    schema,
                    // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                    defer: "private",
                }),
            /must be a boolean/,
        );
        assert.throws(
            () =>
                new Handler({
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
    class UserCommand extends Command<ApplicationCommandType.User> {
        constructor() {
            super({
                builder: new UserContextCommandBuilder().setName("Inspect"),
                // @ts-expect-error Exercise runtime rejection for JavaScript callers.
                input: { schema },
            });
        }

        async run(_ctx: CommandContext<ApplicationCommandType.User>) {}
    }

    assert.throws(() => new UserCommand(), /require a chat-input command/);
});
