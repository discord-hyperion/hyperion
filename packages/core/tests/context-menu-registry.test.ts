import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TestContext, test } from "node:test";
import {
    MessageContextCommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import { ApplicationCommandType, DiscordAPIError, REST } from "discord.js";
import {
    CommandRegistry,
    type CommandType,
    HyperionClient,
} from "../src/index.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

const commandModule = new URL("../src/commands/command.ts", import.meta.url)
    .href;
const buildersModule = import.meta.resolve("@discordjs/builders");

test("native context-menu builders serialize the fixed types declared by Hyperion", () => {
    const user = new UserContextCommandBuilder({
        name: "Inspect",
        type: ApplicationCommandType.Message,
    });
    const message = new MessageContextCommandBuilder({
        name: "Inspect",
        type: ApplicationCommandType.User,
    });

    for (const validate of [false, true]) {
        assert.equal(user.toJSON(validate).type, ApplicationCommandType.User);
        assert.equal(
            message.toJSON(validate).type,
            ApplicationCommandType.Message,
        );
    }
});
const source = (type: CommandType, name = "inspect", extra = "") => {
    const builder =
        type === ApplicationCommandType.ChatInput
            ? "ChatInputCommandBuilder"
            : type === ApplicationCommandType.User
              ? "UserContextCommandBuilder"
              : "MessageContextCommandBuilder";

    return `
        import { defineCommand } from ${JSON.stringify(commandModule)};
        import { ${builder} } from ${JSON.stringify(buildersModule)};
        export default defineCommand({
            builder: new ${builder}().setName(${JSON.stringify(name)})
                    ${type === ApplicationCommandType.ChatInput ? '.setDescription("Inspect")' : ""}, ...{ ${extra} },
            async run() {},
        })
    `;
};

const fixture = (t: TestContext) =>
    createHandlerRoot(t, "hyperion-context-menus-", "commands");

test("discovers all command types in the conventional folder and permits shared names", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "a-slash.mjs"),
        source(ApplicationCommandType.ChatInput),
    );

    await mkdir(path.join(directory, "nested"));

    await writeFile(
        path.join(directory, "nested", "b-user.mjs"),
        source(ApplicationCommandType.User),
    );

    await writeFile(
        path.join(directory, "nested", "c-message.mjs"),
        source(ApplicationCommandType.Message),
    );

    const registry = new CommandRegistry();
    await registry.load(new URL(`file://${root}/`));

    assert.deepEqual(
        [...registry.keys()],
        ["inspect", "2:inspect", "3:inspect"],
    );
    assert.equal(
        registry.resolve("inspect")?.commandType,
        ApplicationCommandType.ChatInput,
    );
    assert.equal(
        registry.resolve("inspect", ApplicationCommandType.User)?.commandType,
        ApplicationCommandType.User,
    );
    assert.equal(
        registry.resolve("inspect", ApplicationCommandType.Message)
            ?.commandType,
        ApplicationCommandType.Message,
    );
    assert.equal(
        registry.resolve("unknown", ApplicationCommandType.User),
        undefined,
    );
});

test("context names preserve capitalization and spaces", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "user.mjs"),
        source(ApplicationCommandType.User, "Inspect User"),
    );

    const registry = new CommandRegistry();
    await registry.load(root);
    assert.equal(
        registry
            .resolve("Inspect User", ApplicationCommandType.User)
            ?.builder.toJSON().name,
        "Inspect User",
    );
    assert.equal(
        registry.resolve("inspect user", ApplicationCommandType.User),
        undefined,
    );
});

test("a builder payload without a type defaults to chat-input commands", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "slash.mjs"),
        source(ApplicationCommandType.ChatInput).replace(
            "new ChatInputCommandBuilder()",
            'Object.assign(new ChatInputCommandBuilder(), { toJSON: () => ({ name: "inspect", description: "Inspect" }) })',
        ),
    );

    const registry = new CommandRegistry();
    await registry.load(root);

    assert.equal(
        registry.resolve("inspect")?.commandType,
        ApplicationCommandType.ChatInput,
    );
    assert.equal(
        registry.resolve("inspect", ApplicationCommandType.User),
        undefined,
    );
});

for (const type of [
    ApplicationCommandType.User,
    ApplicationCommandType.Message,
] as const) {
    test(`duplicate context names of type ${type} preserve the previous registry`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(path.join(directory, "first.mjs"), source(type));
        const registry = new CommandRegistry();
        await registry.load(root);
        const original = registry.resolve("inspect", type);
        await writeFile(path.join(directory, "second.mjs"), source(type));

        await assert.rejects(
            registry.load(root),
            /Duplicate command name "inspect".*second.mjs/,
        );

        assert.equal(registry.resolve("inspect", type), original);
        assert.equal(registry.size, 1);
    });
}

for (const [label, contents] of [
    [
        "builder serialization failure",
        source(ApplicationCommandType.User).replace(
            "new UserContextCommandBuilder()",
            'Object.assign(new UserContextCommandBuilder(), { toJSON: () => { throw new Error("Builder failed"); } })',
        ),
    ],
    [
        "unsupported command type",
        source(ApplicationCommandType.Message).replace(
            "new MessageContextCommandBuilder()",
            'Object.assign(new MessageContextCommandBuilder(), { toJSON: () => ({ name: "inspect", type: 4 }) })',
        ),
    ],
] as const) {
    test(`${label} rejects initialization with the source and original cause`, async t => {
        const { root, directory } = await fixture(t);
        await writeFile(path.join(directory, "broken.mjs"), contents);
        const destroy = t.mock.method(
            HyperionClient.prototype,
            "destroy",
            async () => {},
        );
        t.mock.method(REST.prototype, "get", async () => []);
        const put = t.mock.method(REST.prototype, "put", async () => []);

        await assert.rejects(
            HyperionClient.create({
                name: "Test",
                root,
                discord: { intents: [] },
                logging: false,
                commands: { applicationId: "123", token: "test-token" },
            }),
            error => {
                assert.ok(error instanceof Error);
                assert.match(
                    error.message,
                    /Failed to load command.*broken.mjs/,
                );
                assert.ok(error.cause instanceof Error);

                return true;
            },
        );

        assert.equal(destroy.mock.callCount(), 1);
        assert.equal(put.mock.callCount(), 0);
    });
}

test("context-menu autocomplete is rejected without replacing existing handlers", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "valid.mjs"),
        source(ApplicationCommandType.User),
    );

    const registry = new CommandRegistry();
    await registry.load(root);
    const original = registry.resolve("inspect", ApplicationCommandType.User);

    await writeFile(
        path.join(directory, "broken.mjs"),
        source(ApplicationCommandType.Message).replace(
            "async run() {},",
            "async run() {}, async autocomplete() {},",
        ),
    );

    await assert.rejects(registry.load(root), /broken.mjs.*autocomplete\(\)/);
    assert.equal(
        registry.resolve("inspect", ApplicationCommandType.User),
        original,
    );
});

for (const contextsOnly of [false, true]) {
    test(`bulk registration combines command types in one request (${contextsOnly ? "contexts only" : "mixed"})`, async t => {
        const { root, directory } = await fixture(t);
        for (const type of [
            ApplicationCommandType.User,
            ApplicationCommandType.Message,
        ] as const) {
            await writeFile(
                path.join(directory, `${type}.mjs`),
                source(
                    type,
                    "Inspect",
                    'guards: [() => { throw new Error("Not during deployment"); }]',
                ),
            );
        }

        if (!contextsOnly) {
            await writeFile(
                path.join(directory, "slash.mjs"),
                source(ApplicationCommandType.ChatInput),
            );
        }

        const requests: unknown[] = [];
        t.mock.method(REST.prototype, "get", async () => []);
        const put = t.mock.method(
            REST.prototype,
            "put",
            async (_route: unknown, options: { body: unknown }) => {
                requests.push(options.body);

                return [];
            },
        );

        const client = await HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            logging: false,
            commands: { applicationId: "123", token: "test-token" },
        });

        t.after(() => client.destroy());

        assert.equal(put.mock.callCount(), 1);
        assert.equal(
            put.mock.calls[0]?.arguments[0],
            "/applications/123/commands",
        );
        const body = requests[0] as {
            name: string;
            type: number;
            options?: unknown;
            description?: string;
        }[];
        assert.deepEqual(
            body.map(command => command.type),
            contextsOnly ? [2, 3] : [2, 3, 1],
        );
        assert.ok(
            body
                .filter(command => command.type !== 1)
                .every(command => !command.options && !command.description),
        );
        assert.equal(client.isReady(), false);
    });
}

test("invalid context builders retain serialization source and prevent REST calls", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "invalid.mjs"),
        source(ApplicationCommandType.User, "x".repeat(33)),
    );

    t.mock.method(REST.prototype, "get", async () => []);
    const put = t.mock.method(REST.prototype, "put", async () => []);

    await assert.rejects(
        HyperionClient.create({
            name: "Test",
            root,
            discord: { intents: [] },
            logging: false,
            commands: { applicationId: "123", token: "test-token" },
        }),
        error => {
            assert.ok(error instanceof Error);
            assert.match(
                error.message,
                /Failed to serialize command builder.*invalid.mjs/,
            );
            assert.ok(error.cause instanceof Error);

            return true;
        },
    );

    assert.equal(put.mock.callCount(), 0);
});

test("indexed Discord validation failures identify the context-menu source even for shared names", async t => {
    const { root, directory } = await fixture(t);

    await writeFile(
        path.join(directory, "a-user.mjs"),
        source(ApplicationCommandType.User),
    );

    await writeFile(
        path.join(directory, "b-message.mjs"),
        source(ApplicationCommandType.Message),
    );

    const registry = new CommandRegistry();
    await registry.load(root);
    const failure = new DiscordAPIError(
        {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                "1": {
                    name: {
                        _errors: [{ code: "INVALID", message: "Invalid name" }],
                    },
                },
            },
        },
        50035,
        400,
        "PUT",
        "https://discord.com/api/v10/applications/123/commands",
        { body: [] },
    );
    t.mock.method(REST.prototype, "get", async () => []);
    t.mock.method(REST.prototype, "put", async () => {
        throw failure;
    });

    await assert.rejects(
        registry.register({ applicationId: "123", token: "test-token" }),
        error => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /body\[1\]: "inspect".*b-message.mjs/);
            assert.equal(error.cause, failure);

            return true;
        },
    );
});
