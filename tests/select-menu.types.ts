import {
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import type { ComponentType } from "discord.js";
import type {
    SelectMenuContext,
    SelectMenuOptions,
} from "../src/components/index.ts";

// Checked by tsc; this function is never invoked at runtime.
export const selectMenuContracts = (
    stringCtx: SelectMenuContext,
    userCtx: SelectMenuContext<ComponentType.UserSelect>,
    roleCtx: SelectMenuContext<ComponentType.RoleSelect>,
) => {
    stringCtx.interaction.values satisfies string[];
    userCtx.interaction.users.first()?.username satisfies string | undefined;
    userCtx.interaction.members.size satisfies number;
    roleCtx.interaction.roles.first()?.name satisfies string | undefined;
    roleCtx.interaction.values satisfies string[];

    // @ts-expect-error Role selects do not expose resolved users.
    roleCtx.interaction.users;

    // @ts-expect-error String selects do not expose resolved users.
    stringCtx.interaction.users;

    const userOptions: SelectMenuOptions<ComponentType.UserSelect> = {
        builder: new UserSelectMenuBuilder().setCustomId("user"),
        guards: [
            ctx => {
                ctx.interaction.users.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };
    const stringOptions: SelectMenuOptions = {
        builder: new StringSelectMenuBuilder().setCustomId("string"),
    };
    const wrongUser: SelectMenuOptions<ComponentType.UserSelect> = {
        // @ts-expect-error A user handler requires a user builder.
        builder: stringOptions.builder,
    };
    const wrongString: SelectMenuOptions = {
        // @ts-expect-error Default string handlers require a string builder.
        builder: userOptions.builder,
    };

    const roleOptions: SelectMenuOptions<ComponentType.RoleSelect> = {
        builder: new RoleSelectMenuBuilder().setCustomId("role"),
        guards: [
            ctx => {
                ctx.interaction.roles.size satisfies number;
                throw new Error("Type contract only");
            },
        ],
    };
    const wrongRole: SelectMenuOptions<ComponentType.RoleSelect> = {
        // @ts-expect-error A role handler requires a role builder.
        builder: userOptions.builder,
    };
    const roleAsUser: SelectMenuOptions<ComponentType.UserSelect> = {
        // @ts-expect-error A user handler cannot accept a role builder.
        builder: roleOptions.builder,
    };

    return {
        userOptions,
        stringOptions,
        roleOptions,
        wrongUser,
        wrongString,
        wrongRole,
        roleAsUser,
    };
};
