import { UserSelectMenuBuilder } from "@discordjs/builders";
import { ComponentType, type UserSelectMenuInteraction } from "discord.js";
import * as v from "valibot";
import {
    defineButton,
    defineParams,
    defineSelectMenu,
    paramOwner,
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

export const Assign = defineSelectMenu({
    componentType: ComponentType.UserSelect,
    params: assign,
    guards: [paramOwner("owner")],
    run: async ctx => {
        ctx.interaction satisfies UserSelectMenuInteraction;
        const [issues, params] = ctx.params;

        if (issues) {
            params satisfies undefined;

            return;
        }

        params.ticketId satisfies string;
        // @ts-expect-error Params come from schema output.
        params.missing;
    },
});

export const selectContracts = (plain: SelectMenuContext) => {
    // @ts-expect-error Literal select contexts carry no params.
    plain.params;
    // @ts-expect-error A template is optional, so it may be undefined.
    Assign.builder.toJSON();

    const Mismatched = defineSelectMenu({
        componentType: ComponentType.RoleSelect,
        params: assign,
        // @ts-expect-error The template must be the kind of menu the handler answers.
        builder: new UserSelectMenuBuilder().setCustomId("ticket.assign"),
        run: async () => {},
    });

    const Both = defineSelectMenu({
        componentType: ComponentType.UserSelect,
        params: assign,
        // @ts-expect-error Params handlers cannot also declare a literal custom ID.
        customId: "ticket.assign",
        run: async () => {},
    });

    const WithTemplate = defineSelectMenu({
        componentType: ComponentType.UserSelect,
        params: assign,
        builder: new UserSelectMenuBuilder().setPlaceholder("Assign"),
        run: async () => {},
    });

    return [Mismatched, Both, WithTemplate];
};

export const paramOwnerContracts = () => {
    const Typo = defineButton({
        params: assign,
        // @ts-expect-error The key must exist in the params.
        guards: [paramOwner("ownr")],
        run: async () => {},
    });

    const NotAString = defineButton({
        params: counted,
        // @ts-expect-error The owner param must be a string.
        guards: [paramOwner("owner")],
        run: async () => {},
    });

    return [Typo, NotAString];
};
