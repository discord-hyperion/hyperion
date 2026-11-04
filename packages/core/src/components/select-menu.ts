import type {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ComponentType, type MappedInteractionTypes } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import {
    type ParamsDefinition,
    type ParamsResult,
    validateParams,
} from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";

export type SelectMenuType =
    | ComponentType.StringSelect
    | ComponentType.UserSelect
    | ComponentType.RoleSelect
    | ComponentType.MentionableSelect
    | ComponentType.ChannelSelect;

const selectMenuTypes: readonly unknown[] = [
    ComponentType.StringSelect,
    ComponentType.UserSelect,
    ComponentType.RoleSelect,
    ComponentType.MentionableSelect,
    ComponentType.ChannelSelect,
];

type SelectMenuBuilders = {
    [ComponentType.ChannelSelect]: ChannelSelectMenuBuilder;
    [ComponentType.StringSelect]: StringSelectMenuBuilder;
    [ComponentType.UserSelect]: UserSelectMenuBuilder;
    [ComponentType.RoleSelect]: RoleSelectMenuBuilder;
    [ComponentType.MentionableSelect]: MentionableSelectMenuBuilder;
};

export type SelectMenuContext<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<MappedInteractionTypes[Type]> &
    (Params extends ParamsDefinition
        ? { readonly params: ParamsResult<Params> }
        : unknown);

export type SelectMenuHandlerOptions<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> = {
    componentType: Type;
    /** Optional template; callers get copies through `client.selectMenus.build()`. */
    builder?: SelectMenuBuilders[Type];
    guards?: readonly GuardProvider<SelectMenuContext<Type, Params>>[];
} & (Params extends ParamsDefinition
    ? { params: Params; customId?: never }
    : { customId: string; params?: never });

export abstract class SelectMenuHandler<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> {
    readonly builder: SelectMenuBuilders[Type] | undefined;
    readonly componentType: Type;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<SelectMenuContext<Type, Params>>[];

    protected constructor(options: SelectMenuHandlerOptions<Type, Params>) {
        if (!selectMenuTypes.includes(options.componentType)) {
            throw new TypeError(
                "Select menu handlers require a select componentType.",
            );
        }

        this.params = validateParams(options.params);
        this.customId = handlerCustomId(
            "Select menu",
            options.customId,
            this.params,
        );
        this.componentType = options.componentType;
        this.builder = options.builder;

        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;

            if (!isGuard(provider)) {
                throw new TypeError(
                    "Select menu guards must be guards from defineGuard() or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: SelectMenuContext<Type, Params>): Promise<void>;
}

export type AnySelectMenuHandler =
    | SelectMenuHandler<ComponentType.StringSelect>
    | SelectMenuHandler<ComponentType.UserSelect>
    | SelectMenuHandler<ComponentType.RoleSelect>
    | SelectMenuHandler<ComponentType.MentionableSelect>
    | SelectMenuHandler<ComponentType.ChannelSelect>;
