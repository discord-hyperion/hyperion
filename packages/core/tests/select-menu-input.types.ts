import {
    ChatInputCommandBuilder,
    StringSelectMenuBuilder,
} from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
    ComponentType,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
} from "discord.js";
import * as v from "valibot";
import {
    type ButtonContext,
    Command,
    defineInput,
    defineParams,
    type ModalContext,
    ModalHandler,
    type SelectMenuContext,
    SelectMenuHandler,
    type SelectMenuHandlerOptions,
} from "../src/index.ts";

const priority = defineInput({
    schema: v.pipe(v.array(v.picklist(["low", "high"])), v.length(1)),
    defer: "update",
});

const ticket = defineParams({
    id: "ticket.assign",
    keys: ["ticketId"],
    schema: v.object({ ticketId: v.string() }),
});

const assignee = defineInput({
    schema: v.array(v.string()),
    resolve: (
        ids,
        ctx: SelectMenuContext<{
            componentType: ComponentType.UserSelect;
            params: typeof ticket;
        }>,
    ) => {
        ctx.interaction satisfies UserSelectMenuInteraction;
        ctx.params satisfies unknown;
        // @ts-expect-error Resolvers run before the handler sees input.
        ctx.input;

        return ctx.interaction.users.get(ids[0] ?? "");
    },
});

type Priority = { input: typeof priority };

export class PriorityMenu extends SelectMenuHandler<Priority> {
    constructor() {
        super({
            componentType: 3 as ComponentType.StringSelect,
            customId: "todo.priority",
            input: priority,
            guards: [
                ctx => {
                    ctx.interaction satisfies StringSelectMenuInteraction;
                    // @ts-expect-error Guards run before input.
                    ctx.input;
                    throw new Error("Type-only fixture");
                },
            ],
        });
    }

    async run(ctx: SelectMenuContext<Priority>) {
        const [issues, value] = ctx.input;

        if (issues) {
            issues satisfies readonly StandardSchemaV1.Issue[];

            return;
        }

        value satisfies ("low" | "high")[];
        // @ts-expect-error Input is readonly.
        ctx.input = [null, value];
    }
}

type Assign = {
    componentType: ComponentType.UserSelect;
    params: typeof ticket;
    input: typeof assignee;
};

export class AssignMenu extends SelectMenuHandler<Assign> {
    constructor() {
        super({
            componentType: 5 as ComponentType.UserSelect,
            params: ticket,
            input: assignee,
        });
    }

    async run(ctx: SelectMenuContext<Assign>) {
        const [, params] = ctx.params;
        const [issues, user] = ctx.input;
        if (issues || !params) return;
        params.ticketId satisfies string;
        user?.username satisfies string | undefined;
    }
}

export const specContracts = (plain: SelectMenuContext) => {
    plain.interaction satisfies StringSelectMenuInteraction;
    // @ts-expect-error Plain select contexts have no input.
    plain.input;
    // @ts-expect-error A misspelled key is rejected, not ignored.
    type _SelectTypo = SelectMenuHandler<{ inptu: typeof priority }>;
    // @ts-expect-error A misspelled key is rejected, not ignored.
    type _ModalTypo = ModalContext<{ parms: typeof ticket }>;
    // @ts-expect-error Buttons take no input.
    type _ButtonInput = ButtonContext<{ input: typeof priority }>;
    const both = {
        customId: "todo.priority",
        componentType: 3 as ComponentType.StringSelect,
        builder: new StringSelectMenuBuilder().setCustomId("todo.priority"),
        input: priority,
    };
    // @ts-expect-error A template supplies the custom ID, so customId is rejected.
    both satisfies SelectMenuHandlerOptions<Priority>;
    // @ts-expect-error The resolver needs a user select with params.
    type _WrongMenu = SelectMenuHandler<{ input: typeof assignee }>;

    class MissingInput extends SelectMenuHandler<Priority> {
        constructor() {
            // @ts-expect-error A typed handler must configure its input.
            super({
                componentType: 3 as ComponentType.StringSelect,
                customId: "todo.priority",
            });
        }

        async run() {}
    }

    class UpdateModal extends ModalHandler<{ input: typeof priority }> {
        constructor() {
            super({ customId: "todo.rename", input: priority });
        }

        async run() {}
    }

    return [MissingInput, UpdateModal];
};

abstract class InputCommand extends Command<typeof priorityCommand> {}
const priorityCommand = defineInput({
    schema: v.object({ name: v.string() }),
    defer: true,
});
const updateCommand = defineInput({
    schema: v.object({ name: v.string() }),
    defer: "update",
});

export const commandContracts = () => {
    const builder = new ChatInputCommandBuilder();
    const options = { builder, input: updateCommand };
    // @ts-expect-error Commands have no message to update.
    options satisfies ConstructorParameters<typeof InputCommand>[0];

    return InputCommand;
};
