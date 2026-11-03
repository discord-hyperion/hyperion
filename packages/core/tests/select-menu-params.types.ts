import { UserSelectMenuBuilder } from "@discordjs/builders";
import { ComponentType, type UserSelectMenuInteraction } from "discord.js";
import * as v from "valibot";
import {
    Button,
    type ButtonContext,
    defineParams,
    ParamOwner,
    SelectMenu,
    type SelectMenuContext,
} from "../src/index.ts";

const assign = defineParams({
    id: "ticket.assign",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

const counted = defineParams({
    id: "counted",
    keys: ["owner"],
    schema: v.object({ owner: v.pipe(v.string(), v.toNumber()) }),
});

type AssignContext = SelectMenuContext<ComponentType.UserSelect, typeof assign>;

export class Assign extends SelectMenu<
    ComponentType.UserSelect,
    typeof assign
> {
    constructor() {
        super({
            componentType: ComponentType.UserSelect,
            params: assign,
            guards: [new ParamOwner("owner")],
        });
    }

    async run(ctx: AssignContext) {
        ctx.interaction satisfies UserSelectMenuInteraction;
        const [issues, params] = ctx.params;
        if (issues) {
            params satisfies undefined;
            return;
        }

        params.ticketId satisfies string;
        // @ts-expect-error Params come from schema output.
        params.missing;
    }
}

export const selectContracts = (plain: SelectMenuContext) => {
    // @ts-expect-error Literal select contexts carry no params.
    plain.params;
    // @ts-expect-error A params handler has no template builder.
    new Assign().builder.toJSON();

    class Mismatched extends SelectMenu<
        ComponentType.UserSelect,
        typeof assign
    > {
        constructor() {
            super({
                // @ts-expect-error The component type must match the generic.
                componentType: ComponentType.RoleSelect,
                params: assign,
            });
        }

        async run() {}
    }

    class Both extends SelectMenu<ComponentType.UserSelect, typeof assign> {
        constructor() {
            super({
                componentType: ComponentType.UserSelect,
                params: assign,
                // @ts-expect-error Params handlers cannot supply a builder.
                builder: new UserSelectMenuBuilder(),
            });
        }

        async run() {}
    }

    return [Mismatched, Both];
};

export const paramOwnerContracts = () => {
    class Typo extends Button<typeof assign> {
        constructor() {
            // @ts-expect-error The key must exist in the params.
            super({ params: assign, guards: [new ParamOwner("ownr")] });
        }

        async run(_ctx: ButtonContext<typeof assign>) {}
    }

    class NotAString extends Button<typeof counted> {
        constructor() {
            // @ts-expect-error The owner param must be a string.
            super({ params: counted, guards: [new ParamOwner("owner")] });
        }

        async run(_ctx: ButtonContext<typeof counted>) {}
    }

    return [Typo, NotAString];
};
