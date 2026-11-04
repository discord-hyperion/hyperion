import type {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { ComponentType, type MappedInteractionTypes } from "discord.js";
import type {
    CommandInputDefinition,
    InputDefer,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";
import { isGuard } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import { validateInput } from "../util/validate-input.ts";
import { type ParamsDefinition, validateParams } from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";
import type {
    AnyInputDefinition,
    EmptySpec,
    InputContext,
    InputOptions,
    KnownKeys,
    ParamsContext,
    ParamsOptions,
    SpecInput,
    SpecParams,
} from "./handler-spec.ts";

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

/** The keys a select-menu handler's type argument may set. */
export type SelectMenuSpec = {
    componentType?: SelectMenuType;
    params?: ParamsDefinition;
    input?: AnyInputDefinition;
};

type SpecType<Spec> = Spec extends {
    componentType: infer Type extends SelectMenuType;
}
    ? Type
    : ComponentType.StringSelect;

/** The context guards and input resolvers see: params, never input. */
type SelectMenuParamsContext<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> = InteractionContext<MappedInteractionTypes[Type]> & ParamsContext<Params>;

export type SelectMenuInputDefinition<
    Type extends SelectMenuType = ComponentType.StringSelect,
    Params extends ParamsDefinition | undefined = undefined,
> = CommandInputDefinition<SelectMenuParamsContext<Type, Params>, InputDefer>;

/** A select-menu type argument: known keys, and input whose resolver accepts the context. */
export type ValidSelectMenuSpec<Spec> = SelectMenuSpec &
    KnownKeys<Spec, SelectMenuSpec> & {
        input?: SelectMenuInputDefinition<SpecType<Spec>, SpecParams<Spec>>;
    };

export type SelectMenuContext<
    Spec extends ValidSelectMenuSpec<Spec> = EmptySpec,
> = SelectMenuParamsContext<SpecType<Spec>, SpecParams<Spec>> &
    InputContext<SpecInput<Spec>>;

export type SelectMenuHandlerOptions<
    Spec extends ValidSelectMenuSpec<Spec> = EmptySpec,
> = {
    componentType: SpecType<Spec>;
    /** Optional template; callers get copies through `client.selectMenus.build()`. */
    builder?: SelectMenuBuilders[SpecType<Spec>];
    /** Guards run before input, so they see params but never `ctx.input`. */
    guards?: readonly GuardProvider<
        SelectMenuParamsContext<SpecType<Spec>, SpecParams<Spec>>
    >[];
} & InputOptions<
    SpecInput<Spec>,
    SelectMenuInputDefinition<SpecType<Spec>, SpecParams<Spec>>
> &
    ParamsOptions<SpecParams<Spec>>;

export abstract class SelectMenuHandler<
    Spec extends ValidSelectMenuSpec<Spec> = EmptySpec,
> {
    readonly builder: SelectMenuBuilders[SpecType<Spec>] | undefined;
    readonly componentType: SpecType<Spec>;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<
        SelectMenuParamsContext<SpecType<Spec>, SpecParams<Spec>>
    >[];

    readonly input: AnyInputDefinition | undefined;

    protected constructor(options: SelectMenuHandlerOptions<Spec>) {
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
        this.input = validateInput(
            options.input as SelectMenuInputDefinition | undefined,
            { update: true },
        );

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

    abstract run(ctx: SelectMenuContext<Spec>): Promise<void>;
}

export type AnySelectMenuHandler =
    | SelectMenuHandler<{ componentType: ComponentType.StringSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.UserSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.RoleSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.MentionableSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.ChannelSelect }>;
