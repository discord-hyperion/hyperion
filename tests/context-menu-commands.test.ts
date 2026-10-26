import assert from "node:assert/strict";
import { mock, type TestContext, test } from "node:test";
import {
    ChatInputCommandBuilder,
    MessageContextCommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import {
    ApplicationCommandType,
    type AutocompleteInteraction,
    Events,
    type MessageContextMenuCommandInteraction,
    MessageFlags,
    type UserContextMenuCommandInteraction,
} from "discord.js";
import {
    Command,
    type CommandContext,
    CommandRegistry,
    Guard,
    type GuardProvider,
    HyperionClient,
    InteractionDispatcher,
    OwnerOnly,
} from "../src/index.ts";

type ContextType = ApplicationCommandType.User | ApplicationCommandType.Message;
type MenuContext = CommandContext<ContextType>;

class UserCommand extends Command<ApplicationCommandType.User> {
    constructor(
        private readonly execute: (
            ctx: CommandContext<ApplicationCommandType.User>,
        ) => Promise<void>,
        guards: readonly GuardProvider<
            CommandContext<ApplicationCommandType.User>
        >[] = [],
    ) {
        super({
            builder: new UserContextCommandBuilder().setName("Inspect"),
            guards,
        });
    }
    run(ctx: CommandContext<ApplicationCommandType.User>) {
        return this.execute(ctx);
    }
}

class MessageCommand extends Command<ApplicationCommandType.Message> {
    constructor(
        private readonly execute: (
            ctx: CommandContext<ApplicationCommandType.Message>,
        ) => Promise<void>,
        guards: readonly GuardProvider<
            CommandContext<ApplicationCommandType.Message>
        >[] = [],
    ) {
        super({
            builder: new MessageContextCommandBuilder().setName("Inspect"),
            guards,
        });
    }
    run(ctx: CommandContext<ApplicationCommandType.Message>) {
        return this.execute(ctx);
    }
}

const interaction = (type: ContextType, phase = "new", caller = "caller") => {
    const reply = mock.fn(async (_payload: unknown) => {});
    const editReply = mock.fn(async (_payload: unknown) => {});
    const followUp = mock.fn(async (_payload: unknown) => {});
    const showModal = mock.fn(async (_payload: unknown) => {});
    const value = {
        id: "context-command",
        commandName: "Inspect",
        commandType: type,
        guildId: "guild",
        user: { id: caller },
        ...(type === ApplicationCommandType.User
            ? {
                  targetUser: {
                      id: "selected-user",
                      username: "Private target user",
                  },
                  targetMember: null,
              }
            : {
                  targetMessage: {
                      id: "selected-message",
                      content: "Private target content",
                      author: { username: "Private target author" },
                  },
              }),
        deferred: phase === "deferred",
        replied: phase === "replied",
        ephemeral: phase === "deferred" ? false : null,
        isChatInputCommand: () => false,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isUserSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        isModalSubmit: () => false,
        isAutocomplete: () => false,
        isUserContextMenuCommand: () => type === ApplicationCommandType.User,
        isMessageContextMenuCommand: () =>
            type === ApplicationCommandType.Message,
        reply,
        editReply,
        followUp,
        showModal,
    } as unknown as
        | UserContextMenuCommandInteraction
        | MessageContextMenuCommandInteraction;
    return { value, reply, editReply, followUp, showModal };
};

const setup = async (t: TestContext) => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        name: "Test",
        discord: { intents: [] },
        logging: {
            level: "debug",
            pretty: false,
            progress: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });
    t.after(() => client.destroy());
    return { client, records, dispatcher: new InteractionDispatcher(client) };
};

for (const type of [
    ApplicationCommandType.User,
    ApplicationCommandType.Message,
] as const) {
    test(`context command type ${type} receives resolved targets once with scoped logs`, async t => {
        const { client, records } = await setup(t);
        const execute = mock.fn(async (ctx: MenuContext) => {
            assert.equal(ctx.client, client);
            if (ctx.interaction.isUserContextMenuCommand()) {
                assert.equal(ctx.interaction.targetUser.id, "selected-user");
                assert.equal(ctx.interaction.targetMember, null);
            } else {
                assert.equal(
                    ctx.interaction.targetMessage.id,
                    "selected-message",
                );
            }
            await ctx.interaction.reply(await Promise.resolve("Inspected"));
        });
        const command =
            type === ApplicationCommandType.User
                ? new UserCommand(execute)
                : new MessageCommand(execute);
        client.commands.set(CommandRegistry.key("Inspect", type), command);
        const fixture = interaction(type);
        client.emit(Events.InteractionCreate, fixture.value);
        await client.waitForAllListenersToComplete();

        assert.equal(execute.mock.callCount(), 1);
        assert.equal(fixture.reply.mock.callCount(), 1);
        assert.equal(fixture.reply.mock.calls[0]?.arguments[0], "Inspected");
        const completed = records.find(
            record => record.event === "command.completed",
        );
        assert.equal(completed?.command, "Inspect");
        assert.equal(completed?.commandType, type);
        assert.equal(completed?.interactionId, "context-command");
        assert.equal(typeof completed?.durationMs, "number");
        assert.ok(!JSON.stringify(records).includes("Private target"));
    });

    test(`context command type ${type} supports ordered target-aware guard factories and custom rejection`, async t => {
        const { client, dispatcher } = await setup(t);
        class Deny extends Guard<MenuContext> {
            constructor() {
                super({ description: "Denied" });
            }
            run() {
                return false;
            }
            async onFail(ctx: MenuContext) {
                await ctx.interaction.reply("Custom rejection");
            }
        }
        const execute = mock.fn(async (_ctx: MenuContext) => {});
        const later = mock.fn(() => new Deny());
        const factory = mock.fn(async (ctx: MenuContext) => {
            assert.equal(ctx.interaction.commandType, type);
            return new Deny();
        });
        const command =
            type === ApplicationCommandType.User
                ? new UserCommand(execute, [factory, later])
                : new MessageCommand(execute, [factory, later]);
        client.commands.set(CommandRegistry.key("Inspect", type), command);
        assert.equal(factory.mock.callCount(), 0);
        const fixture = interaction(type);
        await dispatcher.dispatch(fixture.value);

        assert.equal(factory.mock.callCount(), 1);
        assert.equal(later.mock.callCount(), 0);
        assert.equal(execute.mock.callCount(), 0);
        assert.equal(
            fixture.reply.mock.calls[0]?.arguments[0],
            "Custom rejection",
        );
    });

    test(`OwnerOnly authorizes the context-menu caller rather than the selected user for type ${type}`, async t => {
        const { client, dispatcher } = await setup(t);
        t.mock.method(client, "getOwnerId", async () => "owner");
        const execute = mock.fn(async (_ctx: MenuContext) => {});
        client.commands.set(
            CommandRegistry.key("Inspect", type),
            type === ApplicationCommandType.User
                ? new UserCommand(execute, [new OwnerOnly()])
                : new MessageCommand(execute, [new OwnerOnly()]),
        );
        const denied = interaction(type);
        await dispatcher.dispatch(denied.value);
        assert.equal(execute.mock.callCount(), 0);
        assert.equal(denied.reply.mock.callCount(), 1);
        await dispatcher.dispatch(interaction(type, "new", "owner").value);
        assert.equal(execute.mock.callCount(), 1);
    });

    for (const stage of ["handler", "guards"]) {
        for (const phase of ["new", "deferred", "replied"]) {
            test(`context command type ${type} ${stage} failures respect ${phase} replies`, async t => {
                const { client, dispatcher, records } = await setup(t);
                const fail = async () => {
                    throw new Error("Private failure");
                };
                const guards = stage === "guards" ? [fail] : [];
                client.commands.set(
                    CommandRegistry.key("Inspect", type),
                    type === ApplicationCommandType.User
                        ? new UserCommand(fail, guards)
                        : new MessageCommand(fail, guards),
                );
                const fixture = interaction(type, phase);
                await dispatcher.dispatch(fixture.value);
                const response =
                    phase === "new"
                        ? fixture.reply
                        : phase === "deferred"
                          ? fixture.editReply
                          : fixture.followUp;

                assert.equal(response.mock.callCount(), 1);
                assert.deepEqual(response.mock.calls[0]?.arguments[0], {
                    content: "Something went wrong while running this command.",
                    ...(phase === "deferred"
                        ? {}
                        : { flags: MessageFlags.Ephemeral }),
                });
                assert.equal(
                    records.find(record => record.event === "command.failed")
                        ?.stage,
                    stage,
                );
            });
        }
    }

    test(`unknown context command type ${type} never executes same-named handlers of other types`, async t => {
        const { client, dispatcher } = await setup(t);
        const execute = mock.fn(async (_ctx: MenuContext) => {});
        const other =
            type === ApplicationCommandType.User
                ? new MessageCommand(execute)
                : new UserCommand(execute);
        class Slash extends Command {
            constructor() {
                super({
                    builder: new ChatInputCommandBuilder()
                        .setName("inspect")
                        .setDescription("Inspect"),
                });
            }
            async run() {
                throw new Error("Not a slash invocation");
            }
        }
        client.commands.set("Inspect", new Slash());
        client.commands.set(
            CommandRegistry.key("Inspect", other.commandType),
            other,
        );
        const fixture = interaction(type);
        await dispatcher.dispatch(fixture.value);

        assert.equal(execute.mock.callCount(), 0);
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content:
                "This command is no longer available. Please try again later.",
            flags: MessageFlags.Ephemeral,
        });
    });

    test(`development context command type ${type} runs its filesystem example`, async t => {
        const { client, dispatcher } = await setup(t);
        t.mock.method(client, "getOwnerId", async () => "owner");
        await client.commands.load(new URL("../dev/bot/", import.meta.url));
        const fixture = interaction(type, "new", "owner");
        await dispatcher.dispatch(fixture.value);

        assert.equal(fixture.reply.mock.callCount(), 1);
        assert.deepEqual(fixture.reply.mock.calls[0]?.arguments[0], {
            content:
                type === ApplicationCommandType.User
                    ? "User: Private target user (selected-user)."
                    : "Message: selected-message. Author: Private target author.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    });
}

test("shared context command names resolve independently and concurrent contexts remain isolated", async t => {
    const { client, dispatcher } = await setup(t);
    const contexts: MenuContext[] = [];
    const execute = async (ctx: MenuContext) => {
        contexts.push(ctx);
        await ctx.interaction.reply(
            await Promise.resolve(String(ctx.interaction.commandType)),
        );
    };
    client.commands.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.User),
        new UserCommand(execute),
    );
    client.commands.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.Message),
        new MessageCommand(execute),
    );
    const user = interaction(ApplicationCommandType.User);
    const message = interaction(ApplicationCommandType.Message);
    await Promise.all([
        dispatcher.dispatch(user.value),
        dispatcher.dispatch(message.value),
    ]);

    assert.notEqual(contexts[0], contexts[1]);
    assert.equal(user.reply.mock.calls[0]?.arguments[0], "2");
    assert.equal(message.reply.mock.calls[0]?.arguments[0], "3");
});

test("expired context command responses are contained and handlers can open a modal without automatic acknowledgment", async t => {
    const { client, dispatcher, records } = await setup(t);
    client.commands.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.User),
        new UserCommand(async ctx => {
            await ctx.interaction.showModal({
                custom_id: "form",
                title: "Form",
                components: [],
            });
        }),
    );
    const fixture = interaction(ApplicationCommandType.User);
    await dispatcher.dispatch(fixture.value);
    assert.equal(fixture.showModal.mock.callCount(), 1);
    assert.equal(fixture.reply.mock.callCount(), 0);

    client.commands.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.User),
        new UserCommand(async () => {
            throw new Error("Failed");
        }),
    );
    fixture.reply.mock.mockImplementation(async () => {
        throw new Error("Expired");
    });
    client.emit(Events.InteractionCreate, fixture.value);
    await client.waitForAllListenersToComplete();
    assert.ok(
        records.some(
            record => record.event === "command.error-response.failed",
        ),
    );
});

test("autocomplete never invokes a same-named context-menu handler", async t => {
    const { client, dispatcher } = await setup(t);
    const execute = mock.fn(async (_ctx: MenuContext) => {});
    client.commands.set(
        CommandRegistry.key("Inspect", ApplicationCommandType.User),
        new UserCommand(execute),
    );
    const fixture = interaction(ApplicationCommandType.User);
    const respond = mock.fn(async (_choices: unknown) => {});
    Object.assign(fixture.value, {
        responded: false,
        isAutocomplete: () => true,
        respond,
    });
    await dispatcher.dispatch(
        fixture.value as unknown as AutocompleteInteraction,
    );
    assert.equal(execute.mock.callCount(), 0);
    assert.deepEqual(respond.mock.calls[0]?.arguments[0], []);
});
