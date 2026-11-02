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

export type SelectMenuType =
    | ComponentType.StringSelect
    | ComponentType.UserSelect
    | ComponentType.RoleSelect
    | ComponentType.MentionableSelect
    | ComponentType.ChannelSelect;

type SelectMenuBuilders = {
    [ComponentType.ChannelSelect]: ChannelSelectMenuBuilder;
    [ComponentType.StringSelect]: StringSelectMenuBuilder;
    [ComponentType.UserSelect]: UserSelectMenuBuilder;
    [ComponentType.RoleSelect]: RoleSelectMenuBuilder;
    [ComponentType.MentionableSelect]: MentionableSelectMenuBuilder;
};

export type SelectMenuContext<
    Type extends SelectMenuType = ComponentType.StringSelect,
> = InteractionContext<MappedInteractionTypes[Type]>;

export type SelectMenuOptions<
    Type extends SelectMenuType = ComponentType.StringSelect,
> = {
    builder: SelectMenuBuilders[Type];
    guards?: readonly GuardProvider<SelectMenuContext<Type>>[];
};

export abstract class SelectMenu<
    Type extends SelectMenuType = ComponentType.StringSelect,
> {
    readonly builder: SelectMenuBuilders[Type];
    readonly componentType: Type;
    readonly customId: string;
    readonly guards: readonly GuardProvider<SelectMenuContext<Type>>[];

    protected constructor(options: SelectMenuOptions<Type>) {
        this.builder = options.builder;
        const data = this.builder.toJSON(false);

        this.customId = data.custom_id;
        // The builder map pairs each generic type with its matching builder.
        this.componentType = data.type as Type;
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

    abstract run(ctx: SelectMenuContext<Type>): Promise<void>;
}

export type AnySelectMenu =
    | SelectMenu<ComponentType.StringSelect>
    | SelectMenu<ComponentType.UserSelect>
    | SelectMenu<ComponentType.RoleSelect>
    | SelectMenu<ComponentType.MentionableSelect>
    | SelectMenu<ComponentType.ChannelSelect>;
