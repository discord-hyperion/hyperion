import type {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ComponentType, type MappedInteractionTypes } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";
import {
    type ParamsDefinition,
    type ParamsResult,
    validateParams,
} from "./custom-id-params.ts";

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

export type SelectMenuOptions<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> = {
    guards?: readonly GuardProvider<SelectMenuContext<Type, Params>>[];
} & (Params extends ParamsDefinition
    ? { componentType: Type; params: Params; builder?: never }
    : {
          builder: SelectMenuBuilders[Type];
          componentType?: never;
          params?: never;
      });

export abstract class SelectMenu<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> {
    /** Literal handlers only; params handlers build their controls per call. */
    readonly builder: Params extends ParamsDefinition
        ? undefined
        : SelectMenuBuilders[Type];
    readonly componentType: Type;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<SelectMenuContext<Type, Params>>[];

    protected constructor(options: SelectMenuOptions<Type, Params>) {
        if (options.builder !== undefined && options.params !== undefined) {
            throw new TypeError(
                "Select menu handlers accept either a builder or params, not both.",
            );
        }

        this.builder = options.builder as this["builder"];
        this.params = validateParams(options.params);

        if (this.params) {
            if (!selectMenuTypes.includes(options.componentType)) {
                throw new TypeError(
                    "Select menu params handlers require a select componentType.",
                );
            }

            this.customId = this.params.id;
            this.componentType = options.componentType as Type;
        } else if (options.builder) {
            const data = options.builder.toJSON(false);

            this.customId = data.custom_id;
            // The builder map pairs each generic type with its matching builder.
            this.componentType = data.type as Type;
        } else {
            throw new TypeError(
                "Select menu handlers require a builder or params.",
            );
        }

        this.guards = Object.freeze([...(options.guards ?? [])]);

        for (const provider of this.guards) {
            if (typeof provider === "function") continue;
            if (
                !(provider instanceof Guard) ||
                typeof provider.run !== "function"
            ) {
                throw new TypeError(
                    "Select menu guards must be Guard instances or guard factories.",
                );
            }
        }
    }

    abstract run(ctx: SelectMenuContext<Type, Params>): Promise<void>;
}

export type AnySelectMenu =
    | SelectMenu<ComponentType.StringSelect>
    | SelectMenu<ComponentType.UserSelect>
    | SelectMenu<ComponentType.RoleSelect>
    | SelectMenu<ComponentType.MentionableSelect>
    | SelectMenu<ComponentType.ChannelSelect>;
