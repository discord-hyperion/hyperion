import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import { type ApplicationCommandType, Collection } from "discord.js";
import {
    type AutocompleteContext,
    type Command,
    type CommandContext,
    type CommandRegistry,
    defineParentCommand,
    defineSubcommand,
    type GuardProvider,
    ownerOnly,
    type ParentCommand,
    type Subcommand,
} from "../src/index.ts";

export const subcommandContracts = (
    registry: CommandRegistry,
    parent: ParentCommand,
    leaf: Subcommand,
    ctx: CommandContext,
    autocompleteCtx: AutocompleteContext,
) => {
    registry.parents satisfies Collection<string, ParentCommand>;
    registry.resolve("ping") satisfies Command | undefined;
    registry.resolveSubcommand("tools", "ping") satisfies
        | Subcommand
        | undefined;
    parent.builder satisfies ChatInputCommandBuilder;
    leaf.builder satisfies ChatInputCommandSubcommandBuilder;
    parent.guards satisfies readonly GuardProvider<CommandContext>[];
    leaf.guards satisfies readonly GuardProvider<CommandContext>[];
    leaf.run(ctx) satisfies void | Promise<void>;
    leaf.autocomplete?.(autocompleteCtx) satisfies
        | void
        | Promise<void>
        | undefined;
    parent.serialize("tools", Object.freeze([leaf]));

    // @ts-expect-error Parent metadata has no executable handler.
    parent.run(ctx);
    // @ts-expect-error A leaf is separate from a standalone Command.
    leaf satisfies Command;
    // @ts-expect-error A standalone Command cannot be a discovered leaf.
    parent.serialize("tools", [registry.resolve("ping") as Command]);
    // @ts-expect-error Parent builders are readonly.
    parent.builder = new ChatInputCommandBuilder();
    // @ts-expect-error Leaf builders are readonly.
    leaf.builder = new ChatInputCommandSubcommandBuilder();
    // @ts-expect-error Parent guard lists cannot be mutated.
    parent.guards.push(ownerOnly);
    // @ts-expect-error Leaf guard lists cannot be mutated.
    leaf.guards.push(ownerOnly);
    // @ts-expect-error The parent collection property cannot be replaced.
    registry.parents = new Collection<string, ParentCommand>();
    // @ts-expect-error Run requires a command context rather than autocomplete.
    leaf.run(autocompleteCtx);
    // @ts-expect-error Autocomplete requires its own context.
    leaf.autocomplete?.(ctx);

    const Tools = defineParentCommand({
        builder: new ChatInputCommandBuilder().setDescription("Tools"),
        guards: [
            ctx => {
                ctx satisfies CommandContext;
                ctx.interaction.options.getString("query") satisfies
                    | string
                    | null;
                // @ts-expect-error Parent guards do not receive a context-menu target.
                ctx.interaction.targetUser;

                return ownerOnly;
            },
        ],
    });

    const Search = defineSubcommand({
        builder: new ChatInputCommandSubcommandBuilder()
            .setName("search")
            .setDescription("Search"),
        guards: [
            async ctx => {
                ctx satisfies CommandContext;
                ctx.interaction.options.getString("query") satisfies
                    | string
                    | null;
                // @ts-expect-error Leaf guards do not receive autocomplete contexts.
                ctx.interaction.respond([]);

                return ownerOnly;
            },
        ],
        async run(ctx) {
            await ctx.interaction.reply("Result");
        },
        async autocomplete(ctx) {
            ctx.interaction.options.getFocused();
            await ctx.interaction.respond([]);
        },
    });

    const WrongParent = defineParentCommand({
        // @ts-expect-error Parents require a native top-level chat-input builder.
        builder: new ChatInputCommandSubcommandBuilder(),
    });

    const ContextMenuParent = defineParentCommand({
        // @ts-expect-error Context-menu builders cannot define parents.
        builder: new UserContextCommandBuilder(),
    });

    const TopLevelLeaf = defineSubcommand({
        // @ts-expect-error Leaves require a native subcommand builder.
        builder: new ChatInputCommandBuilder(),
        async run(_ctx) {},
    });

    const WrongContext = defineSubcommand({
        builder: new ChatInputCommandSubcommandBuilder().setName("wrong"),
        // @ts-expect-error Leaves cannot handle user context-menu command contexts.
        async run(_ctx: CommandContext<ApplicationCommandType.User>) {},
    });

    return {
        Tools,
        Search,
        WrongParent,
        ContextMenuParent,
        TopLevelLeaf,
        WrongContext,
    };
};
