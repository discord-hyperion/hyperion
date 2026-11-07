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
    CommandInputSchema,
    InputDefer,
} from "../commands/command-input.ts";
import type { InteractionContext } from "../contexts/index.ts";
import { freezeGuards } from "../guards/guard.ts";
import type { GuardProvider } from "../guards/index.ts";
import { validateInput } from "../util/validate-input.ts";
import { type ParamsDefinition, validateParams } from "./custom-id-params.ts";
import { handlerCustomId } from "./handler-options.ts";
import type {
    AnyInputDefinition,
    EmptySpec,
    HandlerInput,
    HandlerResult,
    InferredInput,
    InferredSpec,
    InputContext,
    InputOptions,
    KnownKeys,
    NoResolve,
    ParamsContext,
    RouteOptions,
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

/** The context for a spec the caller built, so its keys are already known. */
type SelectMenuContextOf<Spec> = SelectMenuParamsContext<
    SpecType<Spec>,
    SpecParams<Spec>
> &
    InputContext<SpecInput<Spec>>;

export type SelectMenuContext<
    Spec extends ValidSelectMenuSpec<Spec> = EmptySpec,
> = SelectMenuContextOf<Spec>;

type SelectMenuRun<Spec> = (ctx: SelectMenuContextOf<Spec>) => HandlerResult;

export type SelectMenuHandlerOptions<Spec extends SelectMenuSpec = EmptySpec> =
    {
        componentType: SpecType<Spec>;
        /** Guards run before input, so they see params but never `ctx.input`. */
        guards?: readonly GuardProvider<
            SelectMenuParamsContext<SpecType<Spec>, SpecParams<Spec>>
        >[];
    } & InputOptions<
        SpecInput<Spec>,
        SelectMenuInputDefinition<SpecType<Spec>, SpecParams<Spec>>
    > &
        RouteOptions<SpecParams<Spec>, SelectMenuBuilders[SpecType<Spec>]>;

export class SelectMenuHandler<Spec extends SelectMenuSpec = EmptySpec> {
    readonly builder: SelectMenuBuilders[SpecType<Spec>] | undefined;
    readonly componentType: SpecType<Spec>;
    readonly params: ParamsDefinition | undefined;
    /** The exact custom ID, or the route for a params handler. */
    readonly customId: string;
    readonly guards: readonly GuardProvider<
        SelectMenuParamsContext<SpecType<Spec>, SpecParams<Spec>>
    >[];

    readonly input: AnyInputDefinition | undefined;
    // Stored loosely so handlers of different specs stay assignable to each
    // other; run() restores the type.
    readonly #run: (ctx: never) => HandlerResult;

    constructor(
        options: SelectMenuHandlerOptions<Spec> & {
            run: SelectMenuRun<Spec>;
        },
    ) {
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
            options.builder,
        );
        this.componentType = options.componentType;
        this.builder = options.builder;
        this.input = validateInput(
            options.input as SelectMenuInputDefinition | undefined,
            { update: true },
        );

        this.guards = freezeGuards("Select menu", options.guards);

        this.#run = options.run;
    }

    run(ctx: SelectMenuContextOf<Spec>): HandlerResult {
        return this.#run(ctx as never);
    }
}

type DefinedSelectMenuSpec<
    Type extends SelectMenuType,
    Params,
    Schema extends CommandInputSchema | undefined,
    Result,
    Defer extends InputDefer,
> = InferredSpec<{
    componentType: Type;
    params: Params;
    input: InferredInput<
        Schema,
        Result,
        SelectMenuParamsContext<Type, Params & (ParamsDefinition | undefined)>,
        Defer
    >;
}>;

/**
 * Defines a select-menu handler. The menu kind, params, and input are inferred,
 * and so is every context type.
 */
export const defineSelectMenu = <
    const Type extends SelectMenuType,
    Params extends ParamsDefinition | undefined = undefined,
    Schema extends CommandInputSchema | undefined = undefined,
    Result = NoResolve,
    Defer extends InputDefer = false,
>(
    options: {
        componentType: Type;
        params?: Params;
        input?: HandlerInput<
            Schema,
            Result,
            SelectMenuParamsContext<Type, Params>,
            Defer
        >;
        guards?: readonly GuardProvider<
            SelectMenuParamsContext<Type, Params>
        >[];
        run: SelectMenuRun<
            DefinedSelectMenuSpec<Type, Params, Schema, Result, Defer>
        >;
    } & RouteOptions<NoInfer<Params>, SelectMenuBuilders[Type]>,
): SelectMenuHandler<
    DefinedSelectMenuSpec<Type, Params, Schema, Result, Defer>
> => {
    if (typeof options?.run !== "function") {
        throw new TypeError(
            "Select menu handlers must provide a run() function.",
        );
    }

    // The options match the inferred spec; TypeScript can't relate the two
    // forms while the type parameters are still generic.
    const handler = new SelectMenuHandler<
        DefinedSelectMenuSpec<Type, Params, Schema, Result, Defer>
    >(options as never);

    Object.freeze(handler);

    return handler;
};

export type AnySelectMenuHandler =
    | SelectMenuHandler<{ componentType: ComponentType.StringSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.UserSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.RoleSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.MentionableSelect }>
    | SelectMenuHandler<{ componentType: ComponentType.ChannelSelect }>;
