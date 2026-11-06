import {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ComponentType } from "discord.js";
import type {
    SelectMenuContext,
    SelectMenuHandlerOptions,
    SelectMenuType,
} from "../src/components/index.ts";

type Builder<Type extends SelectMenuType> = SelectMenuHandlerOptions<{
    componentType: Type;
}>["builder"];
type Expect<Condition extends true> = Condition;

// Every select handler type rejects the builders of the other four select types.
type CrossKindBuilders = {
    [Into in SelectMenuType]: {
        [From in Exclude<
            SelectMenuType,
            Into
        >]: Builder<From> extends Builder<Into> ? From : never;
    }[Exclude<SelectMenuType, Into>];
};
export type NoCrossKindBuilders = Expect<
    CrossKindBuilders[SelectMenuType] extends never ? true : false
>;

// Checked by tsc; this function is never invoked at runtime.
export const selectMenuContracts = (
    stringCtx: SelectMenuContext,
    userCtx: SelectMenuContext<{ componentType: ComponentType.UserSelect }>,
    roleCtx: SelectMenuContext<{ componentType: ComponentType.RoleSelect }>,
    mentionableCtx: SelectMenuContext<{
        componentType: ComponentType.MentionableSelect;
    }>,
    channelCtx: SelectMenuContext<{
        componentType: ComponentType.ChannelSelect;
    }>,
) => {
    stringCtx.interaction.values satisfies string[];
    channelCtx.interaction.values satisfies string[];
    channelCtx.interaction.channels.first()?.id satisfies string | undefined;
    channelCtx.interaction.channels.first()?.type satisfies number | undefined;

    const channel = channelCtx.interaction.channels.first();

    if (channel && "name" in channel) {
        channel.name satisfies string | null | undefined;
    }

    userCtx.interaction.users.first()?.username satisfies string | undefined;
    userCtx.interaction.members.size satisfies number;
    roleCtx.interaction.roles.first()?.name satisfies string | undefined;
    roleCtx.interaction.values satisfies string[];
    mentionableCtx.interaction.values satisfies string[];
    mentionableCtx.interaction.users.first()?.username satisfies
        | string
        | undefined;
    mentionableCtx.interaction.roles.first()?.name satisfies string | undefined;
    mentionableCtx.interaction.members.size satisfies number;

    // @ts-expect-error Mentionable selects do not expose channels.
    mentionableCtx.interaction.channels;

    // @ts-expect-error Role selects do not expose resolved users.
    roleCtx.interaction.users;

    // @ts-expect-error String selects do not expose resolved users.
    stringCtx.interaction.users;

    const userOptions: SelectMenuHandlerOptions<{
        componentType: ComponentType.UserSelect;
    }> = {
        componentType: ComponentType.UserSelect,
        builder: new UserSelectMenuBuilder().setCustomId("user"),
        guards: [
            ctx => {
                ctx.interaction.users.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };
    const stringOptions: SelectMenuHandlerOptions = {
        componentType: ComponentType.StringSelect,
        builder: new StringSelectMenuBuilder().setCustomId("string"),
    };

    const roleOptions: SelectMenuHandlerOptions<{
        componentType: ComponentType.RoleSelect;
    }> = {
        componentType: ComponentType.RoleSelect,
        builder: new RoleSelectMenuBuilder().setCustomId("role"),
        guards: [
            ctx => {
                ctx.interaction.roles.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };

    const mentionableOptions: SelectMenuHandlerOptions<{
        componentType: ComponentType.MentionableSelect;
    }> = {
        componentType: ComponentType.MentionableSelect,
        builder: new MentionableSelectMenuBuilder().setCustomId("mentionable"),
        guards: [
            ctx => {
                ctx.interaction.users.size satisfies number;
                ctx.interaction.roles.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };

    const mismatchedTemplate: SelectMenuHandlerOptions<{
        componentType: ComponentType.UserSelect;
    }> = {
        componentType: ComponentType.UserSelect,
        // @ts-expect-error The template must match the declared select type.
        builder: new RoleSelectMenuBuilder().setCustomId("user"),
    };

    const channelOptions: SelectMenuHandlerOptions<{
        componentType: ComponentType.ChannelSelect;
    }> = {
        componentType: ComponentType.ChannelSelect,
        builder: new ChannelSelectMenuBuilder().setCustomId("channel"),
        guards: [
            ctx => {
                ctx.interaction.channels.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };
    // @ts-expect-error Channel selects do not expose resolved users.
    channelCtx.interaction.users;
    // @ts-expect-error Channel selects do not expose resolved roles.
    channelCtx.interaction.roles;

    return {
        channelOptions,
        mismatchedTemplate,
        mentionableOptions,
        userOptions,
        stringOptions,
        roleOptions,
    };
};
