import type { ComponentType } from "discord.js";
import * as v from "valibot";
import {
    type ButtonContext,
    type CommandContext,
    cooldown,
    defineGuard,
    defineParams,
    type Guard,
    type GuardProvider,
    ownerOnly,
    paramOwner,
    type SelectMenuContext,
} from "../src/index.ts";

const ticket = defineParams({
    id: "ticket",
    keys: ["owner"],
    schema: v.object({ owner: v.string() }),
});

export const guardContracts = (entries: Map<string, number>) => {
    // Defaults to the command context.
    const plain = defineGuard({
        name: "plain",
        description: "x",
        run: ctx => {
            ctx satisfies CommandContext;

            return true;
        },
    });
    plain satisfies Guard<CommandContext>;

    // Inferred from the annotated parameter.
    const inferred = defineGuard({
        name: "inferred",
        description: "x",
        run: (ctx: ButtonContext<{ params: typeof ticket }>) =>
            ctx.params[0] === null,
    });
    inferred satisfies Guard<ButtonContext<{ params: typeof ticket }>>;

    // Explicit generic.
    const explicit = defineGuard<
        SelectMenuContext<{ componentType: ComponentType.UserSelect }>
    >({
        name: "explicit",
        description: "x",
        run: ctx => ctx.interaction.users.size > 0,
        onFail: async ctx => {
            ctx.interaction.users satisfies SelectMenuContext<{
                componentType: ComponentType.UserSelect;
            }>["interaction"]["users"];
        },
    });

    const buttonGuards: GuardProvider<
        ButtonContext<{ params: typeof ticket }>
    >[] = [
        inferred,
        ownerOnly,
        paramOwner("owner"),
        cooldown({ key: "k", durationMs: 1, entries: entries as never }),
    ];
    // @ts-expect-error A select-menu guard cannot guard a button.
    const wrongKind: Guard<ButtonContext<{ params: typeof ticket }>> = explicit;
    // @ts-expect-error The key must exist in the params.
    const wrongKey: Guard<ButtonContext<{ params: typeof ticket }>> =
        paramOwner("missing");

    // @ts-expect-error Guards require a name.
    defineGuard({ description: "x", run: () => true });

    // @ts-expect-error Guards are definitions, not structural lookalikes.
    const lookalike: Guard = { name: "x", description: "y", run: () => true };

    return [buttonGuards, wrongKind, wrongKey, lookalike];
};
