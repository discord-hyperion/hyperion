import path from "node:path";
import {
    ApplicationCommandType,
    Collection,
    DiscordAPIError,
    REST,
    Routes,
} from "discord.js";
import type { Logger } from "pino";
import {
    type AnyCommand,
    Command,
    type CommandType,
    ParentCommand,
    Subcommand,
    SubcommandGroup,
} from "../commands/index.ts";
import { discoverHandlerFiles, loadHandler } from "./load-modules.ts";
import { classifyCommandPath } from "./parse-command-path.ts";

type CommandHandler = AnyCommand | Subcommand;
type CommandDefinition = CommandHandler | ParentCommand | SubcommandGroup;
type GroupEntry = {
    name: string;
    command: SubcommandGroup;
    subcommands: Subcommand[];
};
type RegistrationEntry =
    | { kind: "command"; command: AnyCommand }
    | {
          kind: "parent";
          name: string;
          command: ParentCommand;
          subcommands: Subcommand[];
          groups: Collection<string, GroupEntry>;
      };

type CommandMetadata = { source: string; parent?: string; group?: string };
type CommandState = {
    commands: Collection<string, CommandHandler>;
    parents: Collection<string, ParentCommand>;
    groups: Collection<string, SubcommandGroup>;
    metadata: WeakMap<CommandDefinition, CommandMetadata>;
};

const definitionClasses = {
    command: [Command, "defineCommand"],
    parent: [ParentCommand, "defineParentCommand"],
    group: [SubcommandGroup, "defineSubcommandGroup"],
    subcommand: [Subcommand, "defineSubcommand"],
} as const;

/** Builds an ephemeral hierarchy from current membership, never from cached payloads. */
const commandEntries = (state: CommandState, loading = false) => {
    const entries: RegistrationEntry[] = [];
    const parents = new Collection<
        string,
        Extract<RegistrationEntry, { kind: "parent" }>
    >();
    const source = (command: CommandDefinition) =>
        state.metadata.get(command)?.source;
    const parentEntry = (name: string, definition: CommandDefinition) => {
        const command = state.parents.get(name);

        if (!command) {
            throw new Error(
                loading
                    ? `Missing parent definition for "${name}" (referenced by "${source(definition)}").`
                    : `Subcommand in "${source(definition)}" has no parent definition.`,
            );
        }

        let entry = parents.get(name);

        if (!entry) {
            entry = {
                kind: "parent",
                name,
                command,
                subcommands: [],
                groups: new Collection(),
            };
            parents.set(name, entry);
            entries.push(entry);
        }

        return entry;
    };
    const groupEntry = (
        entry: Extract<RegistrationEntry, { kind: "parent" }>,
        name: string,
        definition: CommandDefinition,
    ) => {
        let group = entry.groups.get(name);

        if (!group) {
            const command = state.groups.get(
                CommandRegistry.groupKey(entry.name, name),
            );

            if (!command) {
                throw new Error(
                    loading
                        ? `Missing group definition for "${entry.name} ${name}" (referenced by "${source(definition)}").`
                        : `Subcommand in "${source(definition)}" has no group definition.`,
                );
            }

            group = { name, command, subcommands: [] };
            entry.groups.set(name, group);
        }

        return group;
    };

    if (loading) {
        for (const [name, parent] of state.parents) {
            if (state.commands.get(name) instanceof Command) {
                throw new Error(
                    `Command "${name}" cannot be both a standalone command and a subcommand parent (${source(parent)}).`,
                );
            }

            parentEntry(name, parent);
        }

        for (const [key, group] of state.groups) {
            const route = state.metadata.get(group);

            if (!route?.parent || !route.group) {
                throw new Error(
                    `Missing group ancestry in "${source(group)}".`,
                );
            }

            const conflicting = state.commands.get(key);

            if (conflicting) {
                throw new Error(
                    `Group "${key}" conflicts with a direct subcommand (${source(group)}, ${source(conflicting)}).`,
                );
            }

            groupEntry(parentEntry(route.parent, group), route.group, group);
        }
    }

    for (const command of state.commands.values()) {
        if (command instanceof Command) {
            entries.push({ kind: "command", command });
            continue;
        }

        const route = state.metadata.get(command);

        if (!route?.parent) {
            throw new Error(
                `Subcommand in "${source(command)}" has no parent definition.`,
            );
        }

        const entry = parentEntry(route.parent, command);

        if (route.group === undefined) {
            entry.subcommands.push(command);
        } else {
            groupEntry(entry, route.group, command).subcommands.push(command);
        }
    }

    return entries;
};

const serializeEntry = (
    entry: RegistrationEntry,
    metadata: CommandState["metadata"],
    validate?: boolean,
) => {
    const definitions: CommandDefinition[] =
        entry.kind === "command"
            ? [entry.command]
            : [
                  entry.command,
                  ...entry.subcommands,
                  ...[...entry.groups.values()].flatMap(group => [
                      group.command,
                      ...group.subcommands,
                  ]),
              ];
    try {
        const body =
            entry.kind === "command"
                ? entry.command.builder.toJSON(validate)
                : entry.command.serialize(
                      entry.name,
                      entry.subcommands,
                      validate,
                      [...entry.groups.values()].map(group =>
                          group.command.compose(group.name, group.subcommands),
                      ),
                  );

        return { body, definitions };
    } catch (cause) {
        const sources = definitions
            .map(definition => metadata.get(definition)?.source)
            .filter(source => source !== undefined);
        throw new Error(
            `Failed to serialize command builder in ${sources.map(source => `"${source}"`).join(", ")}: ${cause instanceof Error ? cause.message : String(cause)}`,
            { cause },
        );
    }
};

export type CommandRegistrationOptions = {
    applicationId: string;
    token: string;
    /** Omit for global registration; provide guild IDs for development. */
    guildIds?: readonly string[];
};

export class CommandRegistry extends Collection<string, CommandHandler> {
    readonly parents: Collection<string, ParentCommand>;
    readonly groups: Collection<string, SubcommandGroup>;
    private metadata = new WeakMap<CommandDefinition, CommandMetadata>();

    constructor(private readonly logger?: Logger) {
        super();
        this.parents = new Collection();
        this.groups = new Collection();
    }

    static key(
        name: string,
        type: CommandType = ApplicationCommandType.ChatInput,
    ) {
        return type === ApplicationCommandType.ChatInput
            ? name
            : `${type}:${name}`;
    }

    static subcommandKey(parent: string, name: string, group?: string) {
        return group === undefined
            ? `${parent} ${name}`
            : `${parent} ${group} ${name}`;
    }

    static groupKey(parent: string, group: string) {
        return `${parent} ${group}`;
    }

    resolveGroup(parent: string, group: string) {
        return this.groups.get(CommandRegistry.groupKey(parent, group));
    }

    resolve(name: string): Command | undefined;
    resolve(
        name: string,
        type: ApplicationCommandType.ChatInput,
        subcommand: string,
        group?: string,
    ): Subcommand | undefined;
    resolve<Type extends CommandType>(
        name: string,
        type: Type,
    ): Command<Type> | undefined;
    resolve(
        name: string,
        type: CommandType = ApplicationCommandType.ChatInput,
        subcommand?: string,
        group?: string,
    ) {
        if (subcommand) {
            return type === ApplicationCommandType.ChatInput
                ? this.resolveSubcommand(name, subcommand, group)
                : undefined;
        }

        const command = this.get(CommandRegistry.key(name, type));

        return command instanceof Command && command.commandType === type
            ? command
            : undefined;
    }

    hasSubcommands(parent: string) {
        return (
            this.parents.has(parent) &&
            this.some(
                command =>
                    command instanceof Subcommand &&
                    this.metadata.get(command)?.parent === parent,
            )
        );
    }

    resolveSubcommand(parent: string, name: string, group?: string) {
        const command = this.get(
            CommandRegistry.subcommandKey(parent, name, group),
        );

        return command instanceof Subcommand &&
            this.parents.has(parent) &&
            this.metadata.get(command)?.parent === parent &&
            this.metadata.get(command)?.group === group &&
            (group === undefined ||
                this.resolveGroup(parent, group) !== undefined)
            ? command
            : undefined;
    }

    async load(root: string | URL = process.cwd()) {
        const { directory, files } = await discoverHandlerFiles(
            root,
            "commands",
            this.logger,
            true,
        );

        const state: CommandState = {
            commands: new Collection(),
            parents: new Collection(),
            groups: new Collection(),
            metadata: new WeakMap(),
        };
        const { commands, parents, groups, metadata } = state;

        for (const file of files) {
            try {
                const classification = classifyCommandPath(
                    path.relative(directory, file),
                );
                if (!classification) continue;
                const { kind, path: parsed } = classification;

                const [baseClass, definer] = definitionClasses[kind];

                const command = await loadHandler<CommandDefinition>(
                    file,
                    baseClass,
                    definer,
                );

                metadata.set(command, {
                    source: file,
                    ...(parsed.parent ? { parent: parsed.parent } : {}),
                    ...(parsed.group ? { group: parsed.group } : {}),
                });

                if (command instanceof ParentCommand && parsed.parent) {
                    if (parents.has(parsed.parent)) {
                        throw new Error(
                            `Duplicate parent definition "${parsed.parent}".`,
                        );
                    }

                    parents.set(parsed.parent, command);
                    this.logger?.debug(
                        {
                            event: "command.parent.loaded",
                            command: parsed.parent,
                            source: file,
                        },
                        "Loaded parent command",
                    );
                    continue;
                }

                if (
                    command instanceof SubcommandGroup &&
                    parsed.parent &&
                    parsed.group
                ) {
                    const key = CommandRegistry.groupKey(
                        parsed.parent,
                        parsed.group,
                    );

                    if (groups.has(key)) {
                        throw new Error(`Duplicate group definition "${key}".`);
                    }

                    groups.set(key, command);
                    continue;
                }

                if (
                    !(
                        command instanceof Command ||
                        command instanceof Subcommand
                    )
                ) {
                    throw new TypeError("Expected an executable command.");
                }

                const data = command.builder.toJSON(false);

                if (
                    typeof data.name !== "string" ||
                    typeof command.run !== "function"
                ) {
                    throw new TypeError(
                        "Commands must provide a named builder and a run() method.",
                    );
                }

                if (
                    command.autocomplete !== undefined &&
                    (typeof command.autocomplete !== "function" ||
                        (command instanceof Command &&
                            command.commandType !==
                                ApplicationCommandType.ChatInput))
                ) {
                    throw new TypeError(
                        "Commands may configure autocomplete() only as a function on chat-input commands.",
                    );
                }

                if (
                    command instanceof Command &&
                    (data.type ?? ApplicationCommandType.ChatInput) !==
                        command.commandType
                ) {
                    throw new TypeError(
                        "Command builder type must match its handler's command type.",
                    );
                }

                const key = parsed.parent
                    ? CommandRegistry.subcommandKey(
                          parsed.parent,
                          data.name,
                          parsed.group,
                      )
                    : CommandRegistry.key(
                          data.name,
                          command instanceof Command
                              ? command.commandType
                              : ApplicationCommandType.ChatInput,
                      );

                if (commands.has(key)) {
                    throw new Error(
                        `Duplicate command name "${parsed.parent ? key : data.name}" in "${file}".`,
                    );
                }

                commands.set(key, command);
                this.logger?.debug(
                    {
                        event: "command.loaded",
                        command: data.name,
                        ...(parsed.parent ? { parent: parsed.parent } : {}),
                        ...(parsed.group ? { group: parsed.group } : {}),
                        commandType:
                            command instanceof Command
                                ? command.commandType
                                : ApplicationCommandType.ChatInput,
                        source: file,
                    },
                    "Loaded command",
                );
            } catch (cause) {
                throw new Error(
                    `Failed to load command from "${file}": ${cause instanceof Error ? cause.message : String(cause)}`,
                    { cause },
                );
            }
        }

        for (const entry of commandEntries(state, true)) {
            if (entry.kind === "parent") {
                serializeEntry(entry, metadata, false);
            }
        }

        this.clear();
        this.parents.clear();
        this.groups.clear();
        this.metadata = metadata;

        for (const [key, command] of commands) {
            this.set(key, command);
        }

        for (const [key, parent] of parents) {
            this.parents.set(key, parent);
        }

        for (const [key, group] of groups) {
            this.groups.set(key, group);
        }

        this.logger?.info(
            { event: "commands.loaded", count: this.size },
            "Command discovery complete",
        );
    }

    /** Replaces all application commands in each selected scope. */
    async register(options: CommandRegistrationOptions) {
        if (!options.applicationId.trim() || !options.token.trim()) {
            throw new Error(
                "Command registration requires an application ID and bot token.",
            );
        }

        if (options.guildIds?.length === 0) {
            throw new Error(
                "Provide at least one guild ID, or omit guildIds for global registration.",
            );
        }

        if (options.guildIds?.some(id => !id.trim())) {
            throw new Error("Guild IDs must not be empty.");
        }

        if (this.size === 0) {
            throw new Error(
                "No commands were found; refusing to overwrite commands with an empty list.",
            );
        }

        const registrations = commandEntries({
            commands: this,
            parents: this.parents,
            groups: this.groups,
            metadata: this.metadata,
        }).map(entry => serializeEntry(entry, this.metadata));
        const body = registrations.map(registration => registration.body);
        const rest = new REST({ version: "10" }).setToken(options.token);
        const routes = options.guildIds
            ? [...new Set(options.guildIds)].map(id =>
                  Routes.applicationGuildCommands(options.applicationId, id),
              )
            : [Routes.applicationCommands(options.applicationId)];

        for (const route of routes) {
            const started = performance.now();

            try {
                await rest.put(route, { body });
                this.logger?.info(
                    {
                        event: "commands.deployed",
                        route,
                        count: body.length,
                        durationMs: Math.round(performance.now() - started),
                    },
                    "Application commands deployed",
                );
            } catch (cause) {
                const details =
                    cause instanceof Error ? cause.message : String(cause);
                const sources: string[] = [];

                if (
                    cause instanceof DiscordAPIError &&
                    "errors" in cause.rawError
                ) {
                    const errors = cause.rawError.errors;

                    if (errors && typeof errors === "object") {
                        for (const key of Object.keys(errors)) {
                            if (!/^\d+$/.test(key)) continue;

                            const index = Number(key);
                            const registration = registrations[index];

                            if (!registration) continue;

                            for (const definition of registration.definitions) {
                                const source =
                                    this.metadata.get(definition)?.source;
                                sources.push(
                                    `body[${index}]: "${body[index]?.name}"${source ? ` (${source})` : ""}`,
                                );
                            }
                        }
                    }
                }

                throw new Error(
                    [
                        `Failed to register application commands at "${route}": ${details}`,
                        ...sources,
                    ].join("\n"),
                    { cause },
                );
            }
        }
    }
}
