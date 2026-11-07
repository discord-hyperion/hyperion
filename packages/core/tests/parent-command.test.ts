import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    ChatInputCommandSubcommandGroupBuilder,
    disableValidators,
    enableValidators,
    isValidationEnabled,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import {
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
} from "discord.js";
import {
    type CommandContext,
    defineGuard,
    defineParentCommand,
    defineSubcommand,
    type GuardProvider,
} from "../src/index.ts";

const createParent = (
    builder = new ChatInputCommandBuilder().setDescription("Tools"),
    guards?: readonly GuardProvider<CommandContext>[],
) =>
    defineParentCommand({
        builder,
        ...(guards === undefined ? {} : { guards }),
    });

const createLeaf = (
    builder = new ChatInputCommandSubcommandBuilder()
        .setName("ping")
        .setDescription("Ping"),
    guards?: readonly GuardProvider<CommandContext>[],
) =>
    defineSubcommand({
        builder,
        ...(guards === undefined ? {} : { guards }),
        async run() {},
    });

const check = () =>
    defineGuard({
        name: "Check",
        description: "Denied",
        run(_ctx: CommandContext) {
            return true;
        },
    });

test("parent serialization respects SDK validation settings and explicit overrides", () => {
    const enabled = isValidationEnabled();
    const parent = createParent();
    const leaf = createLeaf(
        new ChatInputCommandSubcommandBuilder()
            .setName("invalid")
            .setDescription(""),
    );

    try {
        enableValidators();
        assert.throws(() => parent.serialize("tools", [leaf]));
        disableValidators();
        assert.doesNotThrow(() => parent.serialize("tools", [leaf]));
        assert.throws(() => parent.serialize("tools", [leaf], true));
        assert.equal(parent.builder.options.length, 0);
    } finally {
        if (enabled) {
            enableValidators();
        } else {
            disableValidators();
        }
    }
});

test("parents and leaves retain native builders and separate executable roles", () => {
    const parentBuilder = new ChatInputCommandBuilder().setDescription("Tools");
    const leafBuilder = new ChatInputCommandSubcommandBuilder()
        .setName("ping")
        .setDescription("Ping");
    const parent = createParent(parentBuilder);
    const leaf = createLeaf(leafBuilder);

    assert.equal(parent.builder, parentBuilder);
    assert.equal(leaf.builder, leafBuilder);
    assert.equal("run" in parent, false);
    assert.equal("commandType" in leaf, false);
    assert.equal("serialize" in leaf, false);
    assert.deepEqual(parent.guards, []);
    assert.deepEqual(leaf.guards, []);
});

for (const builder of [
    new UserContextCommandBuilder().setName("Inspect"),
    new ChatInputCommandSubcommandBuilder(),
    new ChatInputCommandSubcommandGroupBuilder(),
    { options: [], toJSON: () => ({ name: "tools", description: "Tools" }) },
]) {
    test(`parent rejects a non-native parent builder: ${builder.constructor.name}`, () => {
        assert.throws(
            () => createParent(builder as unknown as ChatInputCommandBuilder),
            TypeError,
        );
    });
}

for (const builder of [
    new ChatInputCommandBuilder(),
    new UserContextCommandBuilder(),
    new ChatInputCommandSubcommandGroupBuilder(),
    { toJSON: () => ({ name: "ping", description: "Ping", type: 1 }) },
]) {
    test(`leaf rejects a non-native leaf builder: ${builder.constructor.name}`, () => {
        assert.throws(
            () =>
                createLeaf(
                    builder as unknown as ChatInputCommandSubcommandBuilder,
                ),
            TypeError,
        );
    });
}

const manualOptions = {
    subcommand: (builder: ChatInputCommandBuilder) =>
        builder.addSubcommands(child =>
            child.setName("manual").setDescription("Manual child"),
        ),
    group: (builder: ChatInputCommandBuilder) =>
        builder.addSubcommandGroups(group =>
            group
                .setName("manual")
                .setDescription("Manual group")
                .addSubcommands(child =>
                    child.setName("nested").setDescription("Nested child"),
                ),
        ),
    ordinary: (builder: ChatInputCommandBuilder) =>
        builder.addStringOptions(option =>
            option.setName("query").setDescription("Query"),
        ),
};

for (const [name, attach] of Object.entries(manualOptions)) {
    test(`parent rejects manual ${name} options during construction`, () => {
        const builder = attach(
            new ChatInputCommandBuilder().setDescription("Tools"),
        );

        assert.throws(() => createParent(builder));
        assert.equal(builder.options.length, 1);
    });

    test(`parent rejects manual ${name} options attached after it's defined`, () => {
        const parent = createParent();
        attach(parent.builder);
        const manualOption = parent.builder.options[0];

        assert.throws(() => parent.serialize("tools", [createLeaf()]));
        assert.deepEqual(parent.builder.options, [manualOption]);
    });
}

test("parent serialization preserves native metadata and discovered leaf options", () => {
    const builder = new ChatInputCommandBuilder()
        .setDescription("Tool commands")
        .setDescriptionLocalizations({ "en-US": "Tool commands" })
        .setNameLocalizations({ "en-US": "tools" })
        .setContexts(InteractionContextType.Guild)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setNSFW(true);
    const parent = createParent(builder);
    const leaf = createLeaf(
        new ChatInputCommandSubcommandBuilder()
            .setName("search")
            .setDescription("Search")
            .addStringOptions(option =>
                option
                    .setName("query")
                    .setDescription("Query")
                    .setRequired(true)
                    .setAutocomplete(true),
            ),
    );
    const payload = parent.serialize("tools", [leaf]);

    assert.equal(payload.name, "tools");
    assert.equal(payload.description, "Tool commands");
    assert.deepEqual(payload.name_localizations, { "en-US": "tools" });
    assert.deepEqual(payload.description_localizations, {
        "en-US": "Tool commands",
    });
    assert.deepEqual(payload.contexts, [InteractionContextType.Guild]);
    assert.deepEqual(payload.integration_types, [
        ApplicationIntegrationType.GuildInstall,
    ]);
    assert.equal(
        payload.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString(),
    );
    assert.equal(payload.nsfw, true);
    assert.deepEqual(payload.options, [leaf.builder.toJSON()]);
    assert.equal(
        payload.options?.[0]?.type,
        ApplicationCommandOptionType.Subcommand,
    );
    assert.deepEqual(builder.options, []);
});

test("parent accepts a matching explicit name and rejects a mismatched name", () => {
    const matching = createParent(
        new ChatInputCommandBuilder().setName("tools").setDescription("Tools"),
    );
    assert.equal(matching.serialize("tools", [createLeaf()]).name, "tools");

    const mismatched = createParent(
        new ChatInputCommandBuilder().setName("other").setDescription("Tools"),
    );
    assert.throws(() => mismatched.serialize("tools", [createLeaf()]));
    assert.equal(mismatched.builder.toJSON(false).name, "other");
    assert.deepEqual(mismatched.builder.options, []);
});

test("parent rejects an empty discovered child list even with validation disabled", () => {
    const parent = createParent();

    assert.throws(() => parent.serialize("tools", []));
    assert.throws(() => parent.serialize("tools", [], false));
    assert.deepEqual(parent.builder.options, []);
});

test("repeated parent serialization uses only the current discovered children", () => {
    const parent = createParent();
    const first = createLeaf();
    const second = createLeaf(
        new ChatInputCommandSubcommandBuilder()
            .setName("echo")
            .setDescription("Echo"),
    );
    const children = Object.freeze([first, second]);
    const firstPayload = parent.serialize("tools", children);

    assert.deepEqual(parent.builder.options, []);
    assert.deepEqual(parent.serialize("tools", children), firstPayload);
    assert.deepEqual(parent.builder.options, []);
    assert.deepEqual(parent.serialize("tools", [second]).options, [
        second.builder.toJSON(),
    ]);
    assert.deepEqual(
        firstPayload.options,
        children.map(child => child.builder.toJSON()),
    );
    assert.deepEqual(parent.builder.options, []);
});

test("SDK validation failure clears temporary children and allows a corrected retry", () => {
    const parent = createParent();
    const broken = createLeaf(
        new ChatInputCommandSubcommandBuilder().setName("broken"),
    );

    assert.throws(() => parent.serialize("tools", [createLeaf(), broken]));
    assert.deepEqual(parent.builder.options, []);
    broken.builder.setDescription("Fixed");
    assert.deepEqual(parent.serialize("tools", [broken]).options, [
        broken.builder.toJSON(),
    ]);
    assert.deepEqual(parent.builder.options, []);
});

test("parent forwards the validation flag and cleans up when native serialization throws", t => {
    const parent = createParent();
    const leaf = createLeaf();
    const failure = new Error("Serialization failed");
    const original = parent.builder.toJSON.bind(parent.builder);
    const serialize = t.mock.method(
        parent.builder,
        "toJSON",
        (validate?: boolean) => {
            if (parent.builder.options.length === 0) return original(validate);

            assert.deepEqual(parent.builder.options, [leaf.builder]);
            assert.equal(validate, false);
            throw failure;
        },
    );

    assert.throws(
        () => parent.serialize("tools", [leaf], false),
        error => {
            assert.equal(error, failure);

            return true;
        },
    );
    assert.equal(serialize.mock.calls[0]?.arguments[0], false);
    assert.deepEqual(parent.builder.options, []);
    serialize.mock.restore();
    assert.equal(parent.serialize("tools", [leaf]).options?.length, 1);
});

for (const [name, create] of [
    [
        "parent",
        (guards: readonly GuardProvider[]) => createParent(undefined, guards),
    ],
    [
        "leaf",
        (guards: readonly GuardProvider[]) => createLeaf(undefined, guards),
    ],
] as const) {
    test(`${name} validates and freezes copied guards without invoking factories`, () => {
        const guard = check();
        const factory = mock.fn(() => {
            throw new Error("Factory must remain lazy");
        });
        const providers: GuardProvider[] = [guard, factory];
        const handler = create(providers);

        assert.notEqual(handler.guards, providers);
        assert.deepEqual(handler.guards, [guard, factory]);
        assert.ok(Object.isFrozen(handler.guards));
        providers.length = 0;
        assert.deepEqual(handler.guards, [guard, factory]);
        assert.equal(factory.mock.callCount(), 0);

        // A lookalike with every field still is not a guard from defineGuard().
        const lookalike = { name: "x", description: "y", run: () => true };
        for (const invalid of [null, {}, { run: () => true }, lookalike]) {
            assert.throws(() => create([invalid as unknown as GuardProvider]));
        }
    });
}
