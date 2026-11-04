import assert from "node:assert/strict";
import { test } from "node:test";
import {
    BaseInteraction,
    Collection,
    ComponentType,
    MessageFlags,
    ModalSubmitInteraction,
} from "discord.js";
import {
    createAutocompleteInteraction,
    createButtonInteraction,
    createChatInputInteraction,
    createMessageContextInteraction,
    createModalInteraction,
    createSelectInteraction,
    createUserContextInteraction,
} from "../../../tests/fixtures/interactions.ts";

const variants = [
    [
        "chat input",
        createChatInputInteraction,
        ["isCommand", "isChatInputCommand", "isRepliable"],
    ],
    [
        "user context",
        createUserContextInteraction,
        [
            "isCommand",
            "isContextMenuCommand",
            "isUserContextMenuCommand",
            "isRepliable",
        ],
    ],
    [
        "message context",
        createMessageContextInteraction,
        [
            "isCommand",
            "isContextMenuCommand",
            "isMessageContextMenuCommand",
            "isRepliable",
        ],
    ],
    [
        "button",
        createButtonInteraction,
        ["isMessageComponent", "isButton", "isRepliable"],
    ],
    ["modal", createModalInteraction, ["isModalSubmit", "isRepliable"]],
    ["autocomplete", createAutocompleteInteraction, ["isAutocomplete"]],
    ...(
        [
            [ComponentType.StringSelect, "isStringSelectMenu"],
            [ComponentType.UserSelect, "isUserSelectMenu"],
            [ComponentType.RoleSelect, "isRoleSelectMenu"],
            [ComponentType.MentionableSelect, "isMentionableSelectMenu"],
            [ComponentType.ChannelSelect, "isChannelSelectMenu"],
        ] as const
    ).map(
        ([type, predicate]) =>
            [
                predicate,
                () => createSelectInteraction(type),
                [
                    "isMessageComponent",
                    "isSelectMenu",
                    predicate,
                    "isRepliable",
                ],
            ] as const,
    ),
] as const;

const predicateNames = [
    "isAutocomplete",
    "isCommand",
    "isChatInputCommand",
    "isContextMenuCommand",
    "isPrimaryEntryPointCommand",
    "isMessageComponent",
    "isModalSubmit",
    "isUserContextMenuCommand",
    "isMessageContextMenuCommand",
    "isButton",
    "isSelectMenu",
    "isStringSelectMenu",
    "isUserSelectMenu",
    "isRoleSelectMenu",
    "isChannelSelectMenu",
    "isMentionableSelectMenu",
    "isRepliable",
] as const;

const responseNames = [
    "reply",
    "editReply",
    "followUp",
    "deferReply",
    "deferUpdate",
    "update",
    "showModal",
    "respond",
] as const;

for (const [name, create, expected] of variants) {
    test(`${name} uses native predicates and only applicable response methods`, () => {
        const fixture = create();
        const { interaction } = fixture;
        for (const predicate of predicateNames) {
            assert.equal(
                interaction[predicate],
                BaseInteraction.prototype[predicate],
            );
            assert.equal(
                interaction[predicate](),
                expected.some(value => value === predicate),
                predicate,
            );
        }

        for (const method of responseNames) {
            const available = interaction.isAutocomplete()
                ? method === "respond"
                : method === "respond"
                  ? false
                  : method === "deferUpdate" || method === "update"
                    ? interaction.isMessageComponent() ||
                      interaction.isModalSubmit()
                    : method === "showModal"
                      ? !interaction.isModalSubmit()
                      : true;
            assert.equal(method in interaction, available, method);
            assert.equal(fixture[method].mock.callCount(), 0);
        }
        assert.equal("fetchReply" in interaction, false);
        assert.equal("value" in fixture, false);
    });
}

test("guild and modal origin predicates use native data requirements", () => {
    const dm = createChatInputInteraction().interaction;
    const guildIdOnly = createChatInputInteraction({
        guildId: "guild",
    }).interaction;
    const raw = createChatInputInteraction({
        guildId: "guild",
        member: { id: "member" },
    }).interaction;
    const cached = createChatInputInteraction({
        guildId: "guild",
        member: { id: "member" },
        guild: { id: "guild" },
    }).interaction;
    for (const interaction of [dm, guildIdOnly, raw, cached]) {
        for (const predicate of [
            "inGuild",
            "inCachedGuild",
            "inRawGuild",
        ] as const) {
            assert.equal(
                interaction[predicate],
                BaseInteraction.prototype[predicate],
            );
        }
    }
    assert.deepEqual(
        [dm.inGuild(), guildIdOnly.inGuild(), raw.inGuild(), cached.inGuild()],
        [false, false, true, true],
    );
    assert.deepEqual(
        [dm.inCachedGuild(), raw.inCachedGuild(), cached.inCachedGuild()],
        [false, false, true],
    );
    assert.deepEqual(
        [dm.inRawGuild(), raw.inRawGuild(), cached.inRawGuild()],
        [false, true, false],
    );

    const modal = createModalInteraction().interaction;
    assert.equal(
        modal.isFromMessage,
        ModalSubmitInteraction.prototype.isFromMessage,
    );
    assert.equal(modal.isFromMessage(), false);
    assert.equal(
        createModalInteraction({
            message: { id: "message" },
        }).interaction.isFromMessage(),
        true,
    );
});

test("response effects transition only after default or customized successful completion", async () => {
    // These two variants cover every transition in the shared fixture core.
    for (const create of [
        createButtonInteraction,
        createAutocompleteInteraction,
    ]) {
        for (const method of responseNames) {
            if (!(method in create().interaction)) continue;
            for (const custom of [false, true]) {
                const fixture = create();
                const sentinel = { custom };

                if (custom) {
                    fixture[method].mock.mockImplementation(
                        async () => sentinel,
                    );
                }

                const argument =
                    method === "respond"
                        ? []
                        : { flags: MessageFlags.Ephemeral };

                const result = await Reflect.get(
                    fixture.interaction,
                    method,
                )(argument);

                assert.equal(result, custom ? sentinel : undefined);
                assert.equal(fixture[method].mock.callCount(), 1);
                assert.equal(
                    fixture[method].mock.calls[0]?.arguments[0],
                    argument,
                );

                if (fixture.interaction.isAutocomplete()) {
                    assert.equal(fixture.interaction.responded, true);
                } else {
                    assert.equal(
                        fixture.interaction.deferred,
                        method === "deferReply" || method === "deferUpdate",
                    );
                    assert.equal(
                        fixture.interaction.replied,
                        method !== "deferReply" && method !== "deferUpdate",
                    );
                    assert.equal(
                        fixture.interaction.ephemeral,
                        method === "reply" || method === "deferReply"
                            ? true
                            : null,
                    );
                }
            }
        }
    }
});

test("rejected and in-flight custom effects preserve acknowledgment state", async () => {
    for (const create of [
        createButtonInteraction,
        createAutocompleteInteraction,
    ]) {
        for (const method of responseNames) {
            const fixture = create();
            if (!(method in fixture.interaction)) continue;
            const before = { ...fixture.interaction };
            let complete = () => {};
            const pendingEffect = new Promise<void>(resolve => {
                complete = resolve;
            });
            fixture[method].mock.mockImplementation(() => pendingEffect);
            const pending = Reflect.get(fixture.interaction, method)([]);
            assert.equal(fixture[method].mock.callCount(), 1);
            assert.deepEqual(fixture.interaction, before);
            complete();
            await pending;

            const acknowledged = { ...fixture.interaction };
            const failure = new Error("fixture response failed");
            fixture[method].mock.mockImplementation(async () => {
                throw failure;
            });

            await assert.rejects(
                Reflect.get(fixture.interaction, method)([]),
                error => error === failure,
            );

            assert.deepEqual(fixture.interaction, acknowledged);

            for (const reject of [
                async () => {
                    throw failure;
                },
                () => {
                    throw failure;
                },
            ]) {
                const fresh = create();
                const initial = { ...fresh.interaction };
                fresh[method].mock.mockImplementation(reject);

                await assert.rejects(
                    Reflect.get(fresh.interaction, method)([]),
                    error => error === failure,
                );

                assert.deepEqual(fresh.interaction, initial);
            }
        }
    }
});

test("reply flags resolve through MessageFlagsBitField and updates preserve ephemeral state", async () => {
    for (const flags of [
        MessageFlags.Ephemeral,
        "Ephemeral",
        ["Ephemeral"],
    ] satisfies (MessageFlags.Ephemeral | "Ephemeral" | "Ephemeral"[])[]) {
        const reply = createButtonInteraction();
        await Reflect.get(reply.interaction, "reply")({ flags });
        assert.equal(reply.interaction.ephemeral, true);
        const defer = createButtonInteraction();
        await Reflect.get(defer.interaction, "deferReply")({ flags });
        assert.equal(defer.interaction.ephemeral, true);
    }
    const reply = createChatInputInteraction();
    await reply.interaction.reply("hello");
    assert.equal(reply.interaction.ephemeral, false);
    const defer = createChatInputInteraction();
    await defer.interaction.deferReply();
    assert.equal(defer.interaction.ephemeral, false);
    const update = createButtonInteraction();
    await update.interaction.deferUpdate();
    assert.equal(update.interaction.deferred, true);
    assert.equal(update.interaction.ephemeral, null);
    await update.interaction.editReply("edited");
    assert.equal(update.interaction.deferred, true);
    assert.equal(update.interaction.replied, true);
    assert.equal(update.interaction.ephemeral, null);
    const privateReply = createButtonInteraction({
        deferred: true,
        replied: true,
        ephemeral: true,
    });
    await privateReply.interaction.followUp("more");
    assert.equal(privateReply.interaction.ephemeral, true);
});

test("factories preserve scenario data and create fresh state, histories, and Collections", async () => {
    const user = { id: "caller", username: "Caller" };
    const options = { getSubcommand: () => null };
    const first = createChatInputInteraction({
        id: "command",
        guildId: "guild",
        user,
        options,
        deferred: true,
        ephemeral: false,
    });
    const second = createChatInputInteraction({ user, options });
    assert.equal(first.interaction.id, "command");
    assert.equal(first.interaction.guildId, "guild");
    assert.equal(first.interaction.options.getSubcommand(false), null);
    assert.equal("getString" in first.interaction.options, false);
    await first.interaction.editReply("done");
    assert.equal(second.interaction.replied, false);
    assert.equal(second.editReply.mock.callCount(), 0);
    first.interaction.user.username = "Changed";
    assert.equal(user.username, "Caller");
    assert.equal(second.interaction.user.username, "Caller");
    assert.notEqual(first.interaction.options, options);

    const values = ["selected"];
    const users = new Collection([
        ["selected", { id: "selected", username: "Selected" }],
    ]);
    const selected = createSelectInteraction(ComponentType.UserSelect, {
        values,
        users,
        message: {
            id: "source-message",
            interactionMetadata: { user: { id: "source-owner" } },
        },
    });
    const other = createSelectInteraction(ComponentType.UserSelect, {
        values,
        users,
    });
    selected.interaction.values.push("extra");
    selected.interaction.users.clear();
    assert.notEqual(selected.interaction.members, other.interaction.members);
    assert.deepEqual(values, ["selected"]);
    assert.equal(users.size, 1);
    assert.equal(other.interaction.users.size, 1);
    assert.equal(other.interaction.members.size, 0);
    assert.deepEqual(other.interaction.values, ["selected"]);
    assert.equal(selected.interaction.message.id, "source-message");
    assert.equal(
        selected.interaction.message.interactionMetadata?.user.id,
        "source-owner",
    );
    assert.equal(
        createAutocompleteInteraction({ responded: true }).interaction
            .responded,
        true,
    );
    const targetUser = { id: "target", username: "Target" };
    assert.deepEqual(
        createUserContextInteraction({ targetUser }).interaction.targetUser,
        targetUser,
    );
    const targetMessage = { id: "message", content: "Scenario text" };
    assert.deepEqual(
        createMessageContextInteraction({ targetMessage }).interaction
            .targetMessage,
        targetMessage,
    );
    const getTextInputValue = () => "Scenario input";
    const modal = createModalInteraction({ components: { getTextInputValue } });
    assert.equal(
        modal.interaction.components.getTextInputValue("input"),
        "Scenario input",
    );
});
