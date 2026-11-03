import { mock } from "node:test";
import {
    ApplicationCommandType,
    type AutocompleteInteraction,
    BaseInteraction,
    type ButtonInteraction,
    type Channel,
    type ChatInputCommandInteraction,
    Collection,
    type CommandInteractionOption,
    type CommandInteractionOptionResolver,
    ComponentType,
    type Guild,
    type GuildMember,
    InteractionType,
    type Message,
    type MessageContextMenuCommandInteraction,
    MessageFlags,
    MessageFlagsBitField,
    MessagePayload,
    type ModalComponentResolver,
    ModalSubmitInteraction,
    type Role,
    type SelectMenuInteraction,
    type SelectMenuType,
    type User,
    type UserContextMenuCommandInteraction,
} from "discord.js";

type UserData = Pick<User, "id"> &
    Partial<Pick<User, "username" | "displayAvatarURL">>;
type MemberData = Partial<Pick<GuildMember, "id" | "nickname">> & {
    user?: UserData;
};
type MessageData = Pick<Message, "id"> &
    Partial<Pick<Message, "content">> & {
        author?: Partial<UserData>;
        interactionMetadata?: { user: UserData } | null;
    };
type CommonData = {
    id?: string;
    guildId?: string | null;
    user?: UserData;
    member?: MemberData | null;
    guild?: Pick<Guild, "id"> | null;
    deferred?: boolean;
    replied?: boolean;
    ephemeral?: boolean | null;
};

// Only implemented resolver methods are supplied; overloads that promise a
// required value are unnecessary for these scenario-owned resolver doubles.
type OptionsData = Partial<
    Omit<
        CommandInteractionOptionResolver,
        "get" | "getSubcommand" | "getSubcommandGroup"
    >
> & {
    get?: (name: string, required?: boolean) => CommandInteractionOption | null;
    getSubcommand?: (required?: boolean) => string | null;
    getSubcommandGroup?: (required?: boolean) => string | null;
};
type CommandData = CommonData & {
    commandName?: string;
    options?: OptionsData;
};
type ComponentData = CommonData & {
    customId?: string;
    message?: MessageData | null;
};
type SelectData = {
    values?: readonly string[];
};
type SelectResolvedData = {
    [ComponentType.StringSelect]: Record<never, never>;
    [ComponentType.UserSelect]: {
        users?: Collection<string, UserData>;
        members?: Collection<string, MemberData>;
    };
    [ComponentType.RoleSelect]: {
        roles?: Collection<
            string,
            Pick<Role, "id"> & Partial<Pick<Role, "name">>
        >;
    };
    [ComponentType.MentionableSelect]: SelectResolvedData[ComponentType.UserSelect] &
        SelectResolvedData[ComponentType.RoleSelect];
    [ComponentType.ChannelSelect]: {
        channels?: Collection<
            string,
            Pick<Channel, "id" | "type"> & { name?: string | null }
        >;
    };
};
type SelectInteractionFor<T extends SelectMenuType> = Extract<
    SelectMenuInteraction,
    { componentType: T }
>;

const predicates = {
    inGuild: BaseInteraction.prototype.inGuild,
    inCachedGuild: BaseInteraction.prototype.inCachedGuild,
    inRawGuild: BaseInteraction.prototype.inRawGuild,
    isAutocomplete: BaseInteraction.prototype.isAutocomplete,
    isCommand: BaseInteraction.prototype.isCommand,
    isChatInputCommand: BaseInteraction.prototype.isChatInputCommand,
    isContextMenuCommand: BaseInteraction.prototype.isContextMenuCommand,
    isPrimaryEntryPointCommand:
        BaseInteraction.prototype.isPrimaryEntryPointCommand,
    isMessageComponent: BaseInteraction.prototype.isMessageComponent,
    isModalSubmit: BaseInteraction.prototype.isModalSubmit,
    isUserContextMenuCommand:
        BaseInteraction.prototype.isUserContextMenuCommand,
    isMessageContextMenuCommand:
        BaseInteraction.prototype.isMessageContextMenuCommand,
    isButton: BaseInteraction.prototype.isButton,
    isSelectMenu: BaseInteraction.prototype.isSelectMenu,
    isStringSelectMenu: BaseInteraction.prototype.isStringSelectMenu,
    isUserSelectMenu: BaseInteraction.prototype.isUserSelectMenu,
    isRoleSelectMenu: BaseInteraction.prototype.isRoleSelectMenu,
    isChannelSelectMenu: BaseInteraction.prototype.isChannelSelectMenu,
    isMentionableSelectMenu: BaseInteraction.prototype.isMentionableSelectMenu,
    isRepliable: BaseInteraction.prototype.isRepliable,
};

const createFixture = <T>(
    data: CommonData,
    fields: object,
    kind: "command" | "component" | "modal" | "autocomplete",
) => {
    const interaction = {
        ...predicates,
        id: data.id ?? "test-interaction",
        guildId: data.guildId ?? null,
        guild: data.guild ? { ...data.guild } : null,
        member: data.member ? { ...data.member } : null,
        user: { ...(data.user ?? { id: "test-user" }) },
        ...(kind === "autocomplete"
            ? {}
            : {
                  deferred: data.deferred ?? false,
                  replied: data.replied ?? false,
                  ephemeral: data.ephemeral ?? null,
              }),
        ...fields,
    };
    const effect = <Args extends unknown[] = [options?: unknown]>() =>
        mock.fn(async (..._args: Args): Promise<unknown> => undefined);
    const handles = {
        reply: effect(),
        editReply: effect(),
        followUp: effect(),
        deferReply: effect(),
        deferUpdate: effect(),
        update: effect(),
        showModal: effect(),
        respond: effect<Parameters<AutocompleteInteraction["respond"]>>(),
    };
    const ephemeral = (options: unknown) => {
        const payload =
            options instanceof MessagePayload ? options.options : options;
        const flags =
            payload && typeof payload === "object" && "flags" in payload
                ? payload.flags
                : undefined;
        return new MessageFlagsBitField(
            flags as ConstructorParameters<typeof MessageFlagsBitField>[0],
        ).has(MessageFlags.Ephemeral);
    };
    const attach = (
        name: keyof typeof handles,
        transition: (args: unknown[]) => void,
    ) => {
        Object.assign(interaction, {
            [name]: async (...args: unknown[]) => {
                const result = await (
                    handles[name] as (...args: unknown[]) => Promise<unknown>
                )(...args);
                transition(args);
                return result;
            },
        });
    };

    if (kind === "autocomplete") {
        attach("respond", () =>
            Object.assign(interaction, { responded: true }),
        );
    } else {
        attach("reply", args =>
            Object.assign(interaction, {
                replied: true,
                ephemeral: ephemeral(args[0]),
            }),
        );
        attach("deferReply", args =>
            Object.assign(interaction, {
                deferred: true,
                ephemeral: ephemeral(args[0]),
            }),
        );
        for (const name of ["editReply", "followUp"] as const) {
            attach(name, () => Object.assign(interaction, { replied: true }));
        }
        if (kind === "component" || kind === "modal") {
            attach("deferUpdate", () =>
                Object.assign(interaction, { deferred: true }),
            );
            attach("update", () =>
                Object.assign(interaction, { replied: true }),
            );
        }
        if (kind !== "modal") {
            attach("showModal", () =>
                Object.assign(interaction, { replied: true }),
            );
        }
    }

    // SDK classes require clients, caches, and REST resources. Keep the single
    // structural boundary here; only the explicit fixture surface exists at runtime.
    return { interaction: interaction as unknown as T, ...handles };
};

export const createChatInputInteraction = (data: CommandData = {}) =>
    createFixture<ChatInputCommandInteraction>(
        data,
        {
            type: InteractionType.ApplicationCommand,
            commandType: ApplicationCommandType.ChatInput,
            commandName: data.commandName ?? "test-command",
            options: { ...data.options },
        },
        "command",
    );

export const createUserContextInteraction = (
    data: CommandData & {
        targetUser?: UserData;
        targetMember?: MemberData | null;
    } = {},
) =>
    createFixture<UserContextMenuCommandInteraction>(
        data,
        {
            type: InteractionType.ApplicationCommand,
            commandType: ApplicationCommandType.User,
            commandName: data.commandName ?? "test-command",
            options: { ...data.options },
            ...(data.targetUser
                ? {
                      targetUser: { ...data.targetUser },
                      targetId: data.targetUser.id,
                  }
                : {}),
            targetMember: data.targetMember ? { ...data.targetMember } : null,
        },
        "command",
    );

export const createMessageContextInteraction = (
    data: CommandData & { targetMessage?: MessageData } = {},
) =>
    createFixture<MessageContextMenuCommandInteraction>(
        data,
        {
            type: InteractionType.ApplicationCommand,
            commandType: ApplicationCommandType.Message,
            commandName: data.commandName ?? "test-command",
            options: { ...data.options },
            ...(data.targetMessage
                ? {
                      targetMessage: { ...data.targetMessage },
                      targetId: data.targetMessage.id,
                  }
                : {}),
        },
        "command",
    );

export const createButtonInteraction = (data: ComponentData = {}) =>
    createFixture<ButtonInteraction>(
        data,
        {
            type: InteractionType.MessageComponent,
            componentType: ComponentType.Button,
            customId: data.customId ?? "test-component",
            message: data.message ? { ...data.message } : null,
        },
        "component",
    );

export const createModalInteraction = (
    data: ComponentData & {
        components?: Partial<ModalComponentResolver>;
        message?: MessageData | null;
    } = {},
) =>
    createFixture<ModalSubmitInteraction>(
        data,
        {
            type: InteractionType.ModalSubmit,
            customId: data.customId ?? "test-component",
            components: { ...data.components },
            message: data.message ? { ...data.message } : null,
            isFromMessage: ModalSubmitInteraction.prototype.isFromMessage,
        },
        "modal",
    );

export const createAutocompleteInteraction = (
    data: CommandData & { responded?: boolean } = {},
) =>
    createFixture<AutocompleteInteraction>(
        data,
        {
            type: InteractionType.ApplicationCommandAutocomplete,
            commandType: ApplicationCommandType.ChatInput,
            commandName: data.commandName ?? "test-command",
            options: { ...data.options },
            responded: data.responded ?? false,
        },
        "autocomplete",
    );

export const createSelectInteraction = <T extends SelectMenuType>(
    componentType: T,
    data: ComponentData & SelectData & SelectResolvedData[T] = {},
) => {
    const resolved = data as ComponentData &
        SelectData &
        SelectResolvedData[ComponentType.MentionableSelect] &
        SelectResolvedData[ComponentType.ChannelSelect];
    const fields = {
        type: InteractionType.MessageComponent,
        componentType,
        customId: data.customId ?? "test-component",
        values: [...(data.values ?? [])],
        message: data.message ? { ...data.message } : null,
        ...(componentType === ComponentType.UserSelect ||
        componentType === ComponentType.MentionableSelect
            ? {
                  users: new Collection(resolved.users),
                  members: new Collection(resolved.members),
              }
            : {}),
        ...(componentType === ComponentType.RoleSelect ||
        componentType === ComponentType.MentionableSelect
            ? { roles: new Collection(resolved.roles) }
            : {}),
        ...(componentType === ComponentType.ChannelSelect
            ? { channels: new Collection(resolved.channels) }
            : {}),
    };

    return createFixture<SelectInteractionFor<T>>(data, fields, "component");
};
