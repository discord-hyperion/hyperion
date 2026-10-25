import type {
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ComponentType, type MappedInteractionTypes } from "discord.js";
import type { InteractionContext } from "../contexts/index.ts";
import { Guard, type GuardProvider } from "../guards/index.ts";

export type SelectMenuType =
    | ComponentType.StringSelect
    | ComponentType.UserSelect;

interface SelectMenuBuilders {
    [ComponentType.StringSelect]: StringSelectMenuBuilder;
    [ComponentType.UserSelect]: UserSelectMenuBuilder;
}

export interface SelectMenuContext<
    Type extends SelectMenuType = ComponentType.StringSelect,
> extends InteractionContext<MappedInteractionTypes[Type]> {}

export interface SelectMenuOptions<
    Type extends SelectMenuType = ComponentType.StringSelect,
> {
    builder: SelectMenuBuilders[Type];
    guards?: readonly GuardProvider<SelectMenuContext<Type>>[];
}

export abstract class SelectMenu<
    Type extends SelectMenuType = ComponentType.StringSelect,
> {
    public readonly builder: SelectMenuBuilders[Type];
    public readonly componentType: Type;
    public readonly customId: string;
    public readonly guards: readonly GuardProvider<SelectMenuContext<Type>>[];

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

    public abstract run(ctx: SelectMenuContext<Type>): Promise<void>;
}

export type AnySelectMenu =
    | SelectMenu<ComponentType.StringSelect>
    | SelectMenu<ComponentType.UserSelect>;
