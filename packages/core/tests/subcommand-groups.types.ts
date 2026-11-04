import {
    ChatInputCommandBuilder,
    ChatInputCommandSubcommandBuilder,
    ChatInputCommandSubcommandGroupBuilder,
    UserContextCommandBuilder,
} from "@discordjs/builders";
import { ApplicationCommandType, Collection } from "discord.js";
import {
    type CommandContext,
    type CommandRegistry,
    type GuardProvider,
    ownerOnly,
    type Subcommand,
    SubcommandGroup,
} from "../src/index.ts";

export const subcommandGroupContracts = (
    registry: CommandRegistry,
    group: SubcommandGroup,
    ctx: CommandContext,
    leaf: Subcommand,
) => {
    registry.groups satisfies Collection<string, SubcommandGroup>;
    registry.resolveGroup("ticket", "settings") satisfies
        | SubcommandGroup
        | undefined;
    registry.resolveSubcommand("ticket", "view", "settings") satisfies
        | Subcommand
        | undefined;
    registry.resolve(
        "ticket",
        ApplicationCommandType.ChatInput,
        "view",
        "settings",
    ) satisfies Subcommand | undefined;
    group.builder satisfies ChatInputCommandSubcommandGroupBuilder;
    group.compose(
        "settings",
        Object.freeze([leaf]),
    ) satisfies ChatInputCommandSubcommandGroupBuilder;
    group.guards satisfies readonly GuardProvider<CommandContext>[];

    // @ts-expect-error Groups are non-executable metadata.
    group.run(ctx);
    // @ts-expect-error Groups cannot implement autocomplete hooks.
    group.autocomplete(ctx);
    // @ts-expect-error Groups are not executable leaves.
    group satisfies Subcommand;
    // @ts-expect-error Group builders cannot be replaced.
    group.builder = new ChatInputCommandSubcommandGroupBuilder();
    // @ts-expect-error Group guards are readonly.
    group.guards.push(ownerOnly);
    // @ts-expect-error Group collections cannot be replaced.
    registry.groups = new Collection<string, SubcommandGroup>();
    // @ts-expect-error Context-menu commands cannot have grouped leaves.
    registry.resolve("ticket", ApplicationCommandType.User, "view", "settings");

    class Settings extends SubcommandGroup {
        constructor() {
            super({
                builder:
                    new ChatInputCommandSubcommandGroupBuilder().setDescription(
                        "Settings",
                    ),
                guards: [
                    ctx => {
                        ctx satisfies CommandContext;
                        ctx.interaction.options.getString("query") satisfies
                            | string
                            | null;
                        // @ts-expect-error Group guards receive command contexts, not autocomplete contexts.
                        ctx.interaction.respond([]);

                        return ownerOnly;
                    },
                ],
            });
        }
    }
    class WrongTopLevel extends SubcommandGroup {
        constructor() {
            super({
                // @ts-expect-error Groups require a native group builder.
                builder: new ChatInputCommandBuilder(),
            });
        }
    }
    class WrongLeaf extends SubcommandGroup {
        constructor() {
            super({
                // @ts-expect-error A subcommand builder cannot define a group.
                builder: new ChatInputCommandSubcommandBuilder(),
            });
        }
    }
    class WrongContextMenu extends SubcommandGroup {
        constructor() {
            super({
                // @ts-expect-error A context-menu builder cannot define a group.
                builder: new UserContextCommandBuilder(),
            });
        }
    }

    return { Settings, WrongTopLevel, WrongLeaf, WrongContextMenu };
};
