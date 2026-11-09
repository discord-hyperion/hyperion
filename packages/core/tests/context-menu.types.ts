import {
    ChatInputCommandBuilder,
    MessageContextCommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import { ApplicationCommandType } from "discord.js";
import {
    type AnyInteraction,
    type Command,
    type CommandContext,
    type CommandOptions,
    type CommandRegistry,
    defineCommand,
    ownerOnly,
    type Subcommand,
} from "../src/index.ts";

export const contextMenuContracts = (
    userCtx: CommandContext<ApplicationCommandType.User>,
    messageCtx: CommandContext<ApplicationCommandType.Message>,
    slashCtx: CommandContext,
    registry: CommandRegistry,
) => {
    userCtx.interaction satisfies AnyInteraction;
    messageCtx.interaction satisfies AnyInteraction;
    userCtx.interaction.targetUser.username satisfies string;
    userCtx.interaction.targetMember;
    messageCtx.interaction.targetMessage.content satisfies string;
    slashCtx.interaction.options.getString("query") satisfies string | null;
    registry.resolve("Inspect", ApplicationCommandType.User) satisfies
        | Command<ApplicationCommandType.User>
        | undefined;
    registry.resolve("Inspect", ApplicationCommandType.Message) satisfies
        | Command<ApplicationCommandType.Message>
        | undefined;
    registry.resolve("inspect") satisfies Command | undefined;
    registry.resolveSubcommand("tools", "ping") satisfies
        | Subcommand
        | undefined;
    registry.resolve(
        "tools",
        ApplicationCommandType.ChatInput,
        "ping",
    ) satisfies Subcommand | undefined;
    // @ts-expect-error Context-menu commands cannot resolve subcommands.
    registry.resolve("Inspect", ApplicationCommandType.User, "ping");
    new UserContextCommandBuilder().toJSON(false)
        .type satisfies ApplicationCommandType.User;
    new MessageContextCommandBuilder().toJSON(false)
        .type satisfies ApplicationCommandType.Message;

    // @ts-expect-error User contexts do not expose a selected message.
    userCtx.interaction.targetMessage;
    // @ts-expect-error Message contexts do not expose a selected user.
    messageCtx.interaction.targetUser;
    // @ts-expect-error Context menus have no slash-command string options.
    userCtx.interaction.options.getString("query");
    // @ts-expect-error A non-default generic lookup must specify its type argument at runtime.
    registry.resolve<ApplicationCommandType.User>("Inspect");

    const userOptions: CommandOptions<ApplicationCommandType.User> = {
        builder: new UserContextCommandBuilder().setName("Inspect"),
        guards: [
            ctx => {
                ctx.interaction.targetUser.id satisfies string;

                return ownerOnly;
            },
        ],
    };
    const messageOptions: CommandOptions<ApplicationCommandType.Message> = {
        builder: new MessageContextCommandBuilder().setName("Inspect"),
        guards: [
            ctx => {
                ctx.interaction.targetMessage.id satisfies string;

                return ownerOnly;
            },
        ],
    };
    const wrongBuilder: CommandOptions<ApplicationCommandType.User> = {
        // @ts-expect-error Context menus cannot use a chat-input builder.
        builder: new ChatInputCommandBuilder(),
    };
    const userAsMessage: CommandOptions<ApplicationCommandType.Message> = {
        // @ts-expect-error Message commands require a message builder, not a user builder.
        builder: new UserContextCommandBuilder().setName("Inspect"),
    };
    const messageAsUser: CommandOptions<ApplicationCommandType.User> = {
        // @ts-expect-error User commands require a user builder, not a message builder.
        builder: new MessageContextCommandBuilder().setName("Inspect"),
    };

    const IncorrectMessage = defineCommand({
        builder: new UserContextCommandBuilder().setName("Inspect"),
        run: async ctx => {
            // @ts-expect-error A user builder makes a user command, which has no target message.
            await ctx.interaction.reply(ctx.interaction.targetMessage.id);
        },
    });
    const wrongGuards: CommandOptions<ApplicationCommandType.Message> = {
        builder: new MessageContextCommandBuilder(),
        // @ts-expect-error User-specific guards cannot be attached to message commands.
        guards: userOptions.guards,
    };

    return {
        userOptions,
        messageOptions,
        wrongBuilder,
        userAsMessage,
        messageAsUser,
        IncorrectMessage,
        wrongGuards,
    };
};
