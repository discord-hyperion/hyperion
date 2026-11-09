import { ChatInputCommandBuilder } from "@discordjs/builders";
import {
    defineCommand,
    defineEvent,
    defineInput,
    defineSelectMenu,
    type SelectMenuContext,
} from "@hyperion-js/core";
import { type Collection, ComponentType, Events, type User } from "discord.js";
import * as v from "valibot";

const input = defineInput({
    schema: v.object({ id: v.string() }),
    resolve: async ({ id }) => ({ todo: { id }, found: true }),
});
export const TypedCommand = defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("typed")
        .setDescription("Typed"),
    input,
    run: async ctx => {
        const [issues, value] = ctx.input;
        if (issues) return;
        value.todo.id satisfies string;
        value.found satisfies boolean;
        // @ts-expect-error Inferred output must not degrade to any.
        value.missing;
        // @ts-expect-error Inferred id remains a string.
        const _wrong: number = value.todo.id;
    },
});

const ReadyHandler = defineEvent({
    event: Events.ClientReady,
    run: async ctx => {
        ctx.args[0].user.id satisfies string;
        // @ts-expect-error Readiness provides one argument, not an arbitrary tuple.
        ctx.args[1];
        // @ts-expect-error Managed event registries do not permit raw mutation.
        ctx.client.events.clear();
    },
});
void ReadyHandler;

const priority = defineInput({
    schema: v.array(v.picklist(["low", "high"])),
    defer: "update",
});
export const PriorityMenu = defineSelectMenu({
    customId: "priority",
    componentType: ComponentType.StringSelect,
    input: priority,
    run: async ctx => {
        const [issues, value] = ctx.input;
        if (issues) return;
        value satisfies ("low" | "high")[];
    },
});

export const InlineInput = defineSelectMenu({
    customId: "inline",
    componentType: ComponentType.UserSelect,
    input: {
        schema: v.array(v.string()),
        resolve: ids => ({ first: ids[0] }),
    },
    run: ctx => {
        ctx.interaction.users satisfies Collection<string, User>;
        const [issues, value] = ctx.input;
        if (issues) return;
        value.first satisfies string | undefined;
    },
});

// @ts-expect-error A misspelled type-argument key is rejected, not ignored.
export type Misspelled = SelectMenuContext<{ inptu: typeof priority }>;
