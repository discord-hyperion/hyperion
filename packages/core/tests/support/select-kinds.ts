import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ChannelType, Collection, ComponentType } from "discord.js";
import { createSelectInteraction } from "../../../../tests/fixtures/interactions.ts";
import {
    type AnySelectMenuHandler,
    defineSelectMenu,
    type SelectMenuContext,
    type SelectMenuType,
} from "../../src/components/index.ts";
import type { GuardProvider } from "../../src/guards/index.ts";
import type { Phase } from "./acknowledgment.ts";

export type AnySelectContext = SelectMenuContext<{
    componentType: SelectMenuType;
}>;
export type SelectFixture = ReturnType<
    typeof createSelectInteraction<SelectMenuType>
>;

export type FixtureOptions = {
    phase?: Phase;
    ids?: readonly string[];
    customId?: string;
};

export type SelectKind = {
    name: string;
    type: SelectMenuType;
    customId: string;
    /** Display name the fixtures give a resolved (or, for strings, selected) entry. */
    label: (id: string) => string;
    builder: () => AnySelectMenuHandler["builder"];
    interaction: (options?: FixtureOptions) => SelectFixture;
};

const common = (
    kind: string,
    {
        phase = "new",
        ids = ["selected"],
    }: Omit<FixtureOptions, "customId"> = {},
) => ({
    id: `${kind}-selection`,
    values: ids,
    user: { id: "caller" },
    deferred: phase.startsWith("defer"),
    replied: phase === "replied",
    ephemeral: phase === "defer-reply" ? true : null,
});

const named = (id: string) => ({ id, name: `name-${id}` });

/**
 * One definition per select family. Mentionable fixtures resolve the first
 * selected ID as a user and the rest as roles, so both collections are covered.
 */
export const selectKinds: readonly SelectKind[] = [
    {
        name: "string",
        type: ComponentType.StringSelect,
        customId: "string.choose",
        label: id => id,
        builder: () =>
            new StringSelectMenuBuilder()
                .setCustomId("string.choose")
                .addOptions({ label: "Blue", value: "blue" }),
        interaction: ({ customId = "string.choose", ...options } = {}) =>
            createSelectInteraction(ComponentType.StringSelect, {
                ...common("string", options),
                customId,
            }),
    },
    {
        name: "user",
        type: ComponentType.UserSelect,
        customId: "user.choose",
        label: id => `name-${id}`,
        builder: () => new UserSelectMenuBuilder().setCustomId("user.choose"),
        interaction: ({
            customId = "user.choose",
            ids = ["selected"],
            ...options
        } = {}) =>
            createSelectInteraction(ComponentType.UserSelect, {
                ...common("user", { ...options, ids }),
                customId,
                users: new Collection(
                    ids.map(id => [id, { id, username: `name-${id}` }]),
                ),
                members: new Collection(),
            }),
    },
    {
        name: "role",
        type: ComponentType.RoleSelect,
        customId: "role.choose",
        label: id => `name-${id}`,
        builder: () => new RoleSelectMenuBuilder().setCustomId("role.choose"),
        interaction: ({
            customId = "role.choose",
            ids = ["selected"],
            ...options
        } = {}) =>
            createSelectInteraction(ComponentType.RoleSelect, {
                ...common("role", { ...options, ids }),
                customId,
                roles: new Collection(ids.map(id => [id, named(id)])),
            }),
    },
    {
        name: "mentionable",
        type: ComponentType.MentionableSelect,
        customId: "mentionable.choose",
        label: id => `name-${id}`,
        builder: () =>
            new MentionableSelectMenuBuilder().setCustomId(
                "mentionable.choose",
            ),
        interaction: ({
            customId = "mentionable.choose",
            ids = ["selected"],
            ...options
        } = {}) =>
            createSelectInteraction(ComponentType.MentionableSelect, {
                ...common("mentionable", { ...options, ids }),
                customId,
                users: new Collection(
                    ids
                        .slice(0, 1)
                        .map(id => [id, { id, username: `name-${id}` }]),
                ),
                roles: new Collection(ids.slice(1).map(id => [id, named(id)])),
                members: new Collection(),
            }),
    },
    {
        name: "channel",
        type: ComponentType.ChannelSelect,
        customId: "channel.choose",
        label: id => `name-${id}`,
        builder: () =>
            new ChannelSelectMenuBuilder().setCustomId("channel.choose"),
        interaction: ({
            customId = "channel.choose",
            ids = ["selected"],
            ...options
        } = {}) =>
            createSelectInteraction(ComponentType.ChannelSelect, {
                ...common("channel", { ...options, ids }),
                customId,
                channels: new Collection(
                    ids.map(id => [
                        id,
                        { ...named(id), type: ChannelType.GuildText },
                    ]),
                ),
            }),
    },
];

/** Resolved entries (or selected values for string menus) of any select interaction. */
export const resolvedEntries = (
    interaction: AnySelectContext["interaction"],
) =>
    interaction.isStringSelectMenu()
        ? interaction.values.map(id => ({ id, name: id }))
        : [
              ...("users" in interaction
                  ? interaction.users.map(user => ({
                        id: user.id,
                        name: user.username,
                    }))
                  : []),
              ...("roles" in interaction
                  ? interaction.roles.map(role => ({
                        id: role.id,
                        name: role.name,
                    }))
                  : []),
              ...("channels" in interaction
                  ? interaction.channels.map(channel => ({
                        id: channel.id,
                        name: "name" in channel ? channel.name : channel.id,
                    }))
                  : []),
          ];

type Run = (ctx: AnySelectContext) => Promise<void>;

/** Builds a menu for a kind whose `run` calls `execute`. */
export const createMenu = (
    kind: SelectKind,
    execute: Run,
    guards: readonly GuardProvider<AnySelectContext>[] = [],
): AnySelectMenuHandler => {
    const builder = kind.builder();

    // The kind table pairs each builder with its matching select type, which a
    // union-typed table entry cannot express to the compiler.
    return defineSelectMenu({
        componentType: kind.type as ComponentType.StringSelect,
        builder: builder as StringSelectMenuBuilder,
        guards: guards as readonly GuardProvider<
            SelectMenuContext<{
                componentType: ComponentType.StringSelect;
            }>
        >[],
        run(ctx) {
            return execute(ctx as AnySelectContext);
        },
    });
};
