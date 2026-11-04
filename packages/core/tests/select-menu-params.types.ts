import { UserSelectMenuBuilder } from "@discordjs/builders";
import { ComponentType, type UserSelectMenuInteraction } from "discord.js";
import * as v from "valibot";
import {
    type ButtonContext,
    ButtonHandler,
    defineParams,
    paramOwner,
    type SelectMenuContext,
    SelectMenuHandler,
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

type AssignContext = SelectMenuContext<{
    componentType: ComponentType.UserSelect;
    params: typeof assign;
}>;

export class Assign extends SelectMenuHandler<{
    componentType: ComponentType.UserSelect;
    params: typeof assign;
}> {
    constructor() {
        super({
            componentType: ComponentType.UserSelect,
            params: assign,
            guards: [paramOwner("owner")],
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
    // @ts-expect-error A template is optional, so it may be undefined.
    new Assign().builder.toJSON();

    class Mismatched extends SelectMenuHandler<{
        componentType: ComponentType.UserSelect;
        params: typeof assign;
    }> {
        constructor() {
            super({
                // @ts-expect-error The component type must match the generic.
                componentType: ComponentType.RoleSelect,
                params: assign,
            });
        }

        async run() {}
    }

    class Both extends SelectMenuHandler<{
        componentType: ComponentType.UserSelect;
        params: typeof assign;
    }> {
        constructor() {
            super({
                componentType: ComponentType.UserSelect,
                params: assign,
                // @ts-expect-error Params handlers cannot also declare a literal custom ID.
                customId: "ticket.assign",
            });
        }

        async run() {}
    }

    class WithTemplate extends SelectMenuHandler<{
        componentType: ComponentType.UserSelect;
        params: typeof assign;
    }> {
        constructor() {
            super({
                componentType: ComponentType.UserSelect,
                params: assign,
                builder: new UserSelectMenuBuilder().setPlaceholder("Assign"),
            });
        }

        async run() {}
    }

    return [Mismatched, Both, WithTemplate];
};

export const paramOwnerContracts = () => {
    class Typo extends ButtonHandler<{ params: typeof assign }> {
        constructor() {
            // @ts-expect-error The key must exist in the params.
            super({ params: assign, guards: [paramOwner("ownr")] });
        }

        async run(_ctx: ButtonContext<{ params: typeof assign }>) {}
    }

    class NotAString extends ButtonHandler<{ params: typeof counted }> {
        constructor() {
            // @ts-expect-error The owner param must be a string.
            super({ params: counted, guards: [paramOwner("owner")] });
        }

        async run(_ctx: ButtonContext<{ params: typeof counted }>) {}
    }

    return [Typo, NotAString];
};
