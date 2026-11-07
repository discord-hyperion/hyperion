import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    MessageContextCommandBuilder,
    ModalBuilder,
    PrimaryButtonBuilder,
    StringSelectMenuBuilder,
    UserContextCommandBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import {
    type ChatInputCommandInteraction,
    type ComponentType,
    Events,
    type Message,
    type User,
    type UserSelectMenuInteraction,
} from "discord.js";
import * as v from "valibot";
import {
    type ButtonContext,
    type ButtonHandler,
    defineButton,
    defineCommand,
    defineEvent,
    defineGuard,
    defineInput,
    defineModal,
    defineParams,
    defineSelectMenu,
    defineSubcommand,
    type InteractionContext,
    paramOwner,
} from "../src/index.ts";

const ticket = defineParams({
    id: "ticket.close",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

export const buttons = [
    // Params type ctx.params, with no type argument.
    defineButton({
        params: ticket,
        builder: new PrimaryButtonBuilder().setCustomId("ticket.close"),
        guards: [paramOwner("owner")],
        run: ctx => {
            const [issues, params] = ctx.params;

            if (issues) return;

            params.ticketId satisfies string;
        },
    }),
    // Without params, there's no ctx.params.
    defineButton({
        customId: "profile.refresh",
        run: async ctx => {
            // @ts-expect-error A handler without params has no ctx.params.
            void ctx.params;
            await ctx.interaction.deferUpdate();
        },
    }),
    // @ts-expect-error A handler takes a custom ID or a template, not both.
    defineButton({
        customId: "both",
        builder: new PrimaryButtonBuilder().setCustomId("both"),
        run: () => {},
    }),
    // @ts-expect-error Every handler needs run.
    defineButton({ customId: "missing" }),
];

// A helper typed with the context type accepts the inferred context.
const closeTicket = (ctx: ButtonContext<{ params: typeof ticket }>) =>
    ctx.params;

export const helper = defineButton({
    params: ticket,
    run: ctx => {
        closeTicket(ctx);
    },
});

// A handler refers to itself through its constant.
const refresh = defineButton({
    customId: "self.refresh",
    run: ctx => {
        ctx.client.buttons.build(refresh.customId);
    },
});

export { refresh };

const assign = defineParams({
    id: "ticket.assign",
    keys: ["ticketId"],
    schema: v.object({ ticketId: v.string() }),
});

const guildOnly = defineGuard<InteractionContext>({
    name: "guild-only",
    description: "Use this in a server.",
    run: ctx => ctx.interaction.inGuild(),
});

export const selectMenus = [
    // The kind, params, and an inline resolver that reads ctx.params.
    defineSelectMenu({
        componentType: 5 as ComponentType.UserSelect,
        params: assign,
        builder: new UserSelectMenuBuilder().setCustomId("ticket.assign"),
        guards: [guildOnly],
        input: {
            schema: v.array(v.string()),
            defer: "update",
            resolve: (ids, ctx) => {
                ids satisfies string[];
                const [, params] = ctx.params;

                return { first: ids[0], ticketId: params?.ticketId };
            },
        },
        run: ctx => {
            ctx.interaction satisfies UserSelectMenuInteraction;
            const [issues, value] = ctx.input;

            if (issues) return;

            value.first satisfies string | undefined;
            value.ticketId satisfies string | undefined;
        },
    }),
    // Shared input from defineInput(), without a resolver.
    defineSelectMenu({
        componentType: 3 as ComponentType.StringSelect,
        builder: new StringSelectMenuBuilder().setCustomId("colour"),
        input: defineInput({ schema: v.array(v.string()) }),
        run: ctx => {
            const [issues, colours] = ctx.input;

            if (issues) return;

            colours satisfies string[];
        },
    }),
    // Without input, there's no ctx.input.
    defineSelectMenu({
        componentType: 3 as ComponentType.StringSelect,
        customId: "plain",
        run: ctx => {
            ctx.interaction.values satisfies string[];
            // @ts-expect-error A handler without input has no ctx.input.
            void ctx.input;
        },
    }),
];

export const modals = [
    defineModal({
        params: assign,
        builder: new ModalBuilder().setCustomId("ticket.assign"),
        input: {
            schema: v.object({ title: v.string() }),
            resolve: async ({ title }) => title.trim(),
        },
        run: ctx => {
            const [issues, title] = ctx.input;

            if (issues) return;

            title satisfies string;
            ctx.params satisfies unknown;
        },
    }),
];

export const commands = [
    // A chat-input command with inline input.
    defineCommand({
        builder: new ChatInputCommandBuilder().setName("echo"),
        input: {
            schema: v.object({ text: v.string() }),
            defer: true,
        },
        run: ctx => {
            ctx.interaction satisfies ChatInputCommandInteraction;
            const [issues, value] = ctx.input;

            if (issues) return;

            value.text satisfies string;
        },
        autocomplete: async ctx => {
            await ctx.interaction.respond([]);
        },
    }),
    // The builder decides a context menu's type.
    defineCommand({
        builder: new UserContextCommandBuilder().setName("Inspect"),
        run: ctx => {
            ctx.interaction.targetUser satisfies User;
        },
    }),
    defineCommand({
        builder: new MessageContextCommandBuilder().setName("Quote"),
        run: ctx => {
            ctx.interaction.targetMessage satisfies Message;
        },
    }),
    defineCommand({
        builder: new UserContextCommandBuilder().setName("Inspect"),
        // @ts-expect-error Context menus have no autocomplete.
        autocomplete: async () => {},
        run: () => {},
    }),
];

export const subcommands = [
    defineSubcommand({
        builder: new ChatInputCommandSubcommandBuilder().setName("close"),
        input: {
            schema: v.object({ id: v.string() }),
            resolve: ({ id }) => ({ ticket: id }),
        },
        run: ctx => {
            const [issues, value] = ctx.input;

            if (issues) return;

            value.ticket satisfies string;
        },
    }),
];

export const events = [
    defineEvent({
        event: Events.ClientReady,
        once: true,
        run: ctx => {
            const [client] = ctx.args;

            client.user.id satisfies string;
        },
    }),
    defineEvent({
        event: Events.MessageCreate,
        run: ctx => {
            const [message] = ctx.args;

            message satisfies Message;
        },
    }),
    // @ts-expect-error Event names follow discord.js's event map.
    defineEvent({ event: "client-ready", run: () => {} }),
];

// @ts-expect-error Handlers are defined with a function, not subclassed.
export class Subclassed extends ButtonHandler {}

// The class name stays as the type of what a define function returns.
export const typed: ButtonHandler = defineButton({
    customId: "typed",
    run: () => {},
});
