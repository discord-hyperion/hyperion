import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
import { assertRegistryClass, discoverModules } from "../util/index.ts";
import { parseCommandPath } from "./parse-command-path.ts";

type CommandHandler = AnyCommand | Subcommand;
type CommandDefinition = CommandHandler | ParentCommand | SubcommandGroup;
type GroupEntry = {
    parent: string;
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

export type CommandRegistrationOptions = {
    applicationId: string;
    token: string;
    /** Omit for global registration; provide guild IDs for development. */
    guildIds?: readonly string[];
};

export class CommandRegistry extends Collection<string, CommandHandler> {
    readonly parents: Collection<string, ParentCommand>;
    readonly groups: Collection<string, SubcommandGroup>;
    private sources = new WeakMap<CommandDefinition, string>();
    private parentNames = new WeakMap<Subcommand, string>();
    private groupNames = new WeakMap<Subcommand, string>();

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
                    this.parentNames.get(command) === parent,
            )
        );
    }

    resolveSubcommand(parent: string, name: string, group?: string) {
        const command = this.get(
            CommandRegistry.subcommandKey(parent, name, group),
        );
        return command instanceof Subcommand &&
            this.parents.has(parent) &&
            this.parentNames.get(command) === parent &&
            this.groupNames.get(command) === group &&
            (group === undefined ||
                this.resolveGroup(parent, group) !== undefined)
            ? command
            : undefined;
    }

    async load(root: string | URL = process.cwd()) {
        const rootPath =
            root instanceof URL ? fileURLToPath(root) : path.resolve(root);
        const directory = path.join(rootPath, "src", "commands");

        this.logger?.debug(
            { event: "commands.discover", directory },
            "Discovering command files",
        );

        const files = await discoverModules(
            directory,
            () => {
                this.logger?.debug(
                    { event: "commands.directory.missing", directory },
                    "Optional command directory does not exist",
                );
            },
            { includeIndexes: true },
        );
        const commands = new Collection<string, CommandHandler>();
        const parents = new Collection<string, ParentCommand>();
        const groups = new Collection<string, GroupEntry>();
        const children = new Collection<string, Subcommand[]>();
        const sources = new WeakMap<CommandDefinition, string>();
        const parentNames = new WeakMap<Subcommand, string>();
        const groupNames = new WeakMap<Subcommand, string>();

        for (const file of files) {
            // Only direct parent/group indexes define commands; other indexes remain barrels.
            if (
                /^index\./.test(path.basename(file)) &&
                !(
                    /^index\.[cm]?[jt]s$/.test(path.basename(file)) &&
                    /^(?:\[[^()[\]{}]+\]|\{[^()[\]{}]+\})$/.test(
                        path.basename(path.dirname(file)),
                    )
                )
            )
                continue;

            try {
                const parsed = parseCommandPath(path.relative(directory, file));

                const module = await import(pathToFileURL(file).href);
                const Definition = module.default;

                if (parsed.groupDefinition && parsed.parent && parsed.group) {
                    assertRegistryClass(Definition, SubcommandGroup);
                    const group = new Definition();
                    const key = CommandRegistry.groupKey(
                        parsed.parent,
                        parsed.group,
                    );

                    if (groups.has(key)) {
                        throw new Error(`Duplicate group definition "${key}".`);
                    }

                    groups.set(key, {
                        parent: parsed.parent,
                        name: parsed.group,
                        command: group,
                        subcommands: [],
                    });
                    sources.set(group, file);
                    continue;
                }

                if (parsed.parentDefinition && parsed.parent) {
                    assertRegistryClass(Definition, ParentCommand);
                    const parent = new Definition();

                    if (parents.has(parsed.parent)) {
                        throw new Error(
                            `Duplicate parent definition "${parsed.parent}".`,
                        );
                    }

                    parents.set(parsed.parent, parent);
                    sources.set(parent, file);
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

                let command: CommandHandler;

                if (parsed.parent) {
                    assertRegistryClass(Definition, Subcommand);
                    command = new Definition();
                } else {
                    assertRegistryClass(Definition, Command);
                    command = new Definition();
                }

                if (typeof command.builder?.toJSON !== "function")
                    throw new TypeError(
                        "Commands must provide a command builder.",
                    );

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
                if (command instanceof Command) {
                    if (
                        ![
                            ApplicationCommandType.ChatInput,
                            ApplicationCommandType.User,
                            ApplicationCommandType.Message,
                        ].includes(command.commandType)
                    ) {
                        throw new TypeError(
                            "Command has an unsupported command type.",
                        );
                    }
                    if (
                        (data.type ?? ApplicationCommandType.ChatInput) !==
                        command.commandType
                    ) {
                        throw new TypeError(
                            "Command builder type must match its handler's command type.",
                        );
                    }
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

                if (commands.has(key))
                    throw new Error(
                        `Duplicate command name "${parsed.parent ? key : data.name}" in "${file}".`,
                    );

                if (command instanceof Subcommand && parsed.parent) {
                    parentNames.set(command, parsed.parent);
                    if (parsed.group !== undefined)
                        groupNames.set(command, parsed.group);
                    const siblings = children.get(parsed.parent) ?? [];
                    siblings.push(command);
                    children.set(parsed.parent, siblings);
                }

                commands.set(key, command);
                sources.set(command, file);
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
                const detail =
                    cause instanceof Error ? `: ${cause.message}` : "";
                throw new Error(
                    `Failed to load command from "${file}"${detail}`,
                    { cause },
                );
            }
        }

        for (const [name, subcommands] of children) {
            for (const command of subcommands) {
                const groupName = groupNames.get(command);
                if (groupName === undefined) continue;
                const group = groups.get(
                    CommandRegistry.groupKey(name, groupName),
                );

                if (!group) {
                    throw new Error(
                        `Missing group definition for "${name} ${groupName}" (referenced by "${sources.get(command)}").`,
                    );
                }

                group.subcommands.push(command);
            }
        }

        for (const [key, group] of groups) {
            if (!parents.has(group.parent)) {
                throw new Error(
                    `Missing parent definition for "${group.parent}" (referenced by "${sources.get(group.command)}").`,
                );
            }
            if (commands.has(key)) {
                throw new Error(
                    `Group "${key}" conflicts with a direct subcommand (${sources.get(group.command)}, ${sources.get(commands.get(key) as Subcommand)}).`,
                );
            }
            try {
                group.command.compose(group.name, group.subcommands);
            } catch (cause) {
                throw new Error(
                    `Invalid subcommand group in "${sources.get(group.command)}": ${cause instanceof Error ? cause.message : String(cause)}`,
                    { cause },
                );
            }
        }

        for (const [name, subcommands] of children) {
            if (!parents.has(name)) {
                throw new Error(
                    `Missing parent definition for "${name}"; add [${name}]/index.ts (referenced by "${sources.get(subcommands[0] as Subcommand)}").`,
                );
            }
        }

        for (const [name, parent] of parents) {
            const standalone = commands.get(name);

            if (
                standalone instanceof Command &&
                standalone.commandType === ApplicationCommandType.ChatInput
            ) {
                throw new Error(
                    `Command "${name}" cannot be both a standalone command and a subcommand parent (${sources.get(standalone)}).`,
                );
            }

            try {
                parent.serialize(
                    name,
                    (children.get(name) ?? []).filter(
                        command => !groupNames.has(command),
                    ),
                    false,
                    [...groups.values()]
                        .filter(group => group.parent === name)
                        .map(group =>
                            group.command.compose(
                                group.name,
                                group.subcommands,
                            ),
                        ),
                );
            } catch (cause) {
                const detail =
                    cause instanceof Error ? `: ${cause.message}` : "";
                throw new Error(
                    `Invalid parent command in "${sources.get(parent)}"${detail}`,
                    { cause },
                );
            }
        }

        this.clear();
        this.parents.clear();
        this.groups.clear();
        this.sources = sources;
        this.parentNames = parentNames;
        this.groupNames = groupNames;

        for (const [name, command] of commands) this.set(name, command);
        for (const [name, parent] of parents) this.parents.set(name, parent);
        for (const [name, group] of groups)
            this.groups.set(name, group.command);

        this.logger?.info(
            { event: "commands.loaded", count: this.size },
            "Command discovery complete",
        );
    }

    /** Replaces all application commands in each selected scope. */
    async register(options: CommandRegistrationOptions) {
        if (!options.applicationId.trim() || !options.token.trim())
            throw new Error(
                "Command registration requires an application ID and bot token.",
            );
        if (options.guildIds?.length === 0)
            throw new Error(
                "Provide at least one guild ID, or omit guildIds for global registration.",
            );
        if (options.guildIds?.some(id => !id.trim()))
            throw new Error("Guild IDs must not be empty.");
        if (this.size === 0)
            throw new Error(
                "No commands were found; refusing to overwrite commands with an empty list.",
            );

        const entries: RegistrationEntry[] = [];
        const parentEntries = new Collection<
            string,
            Extract<RegistrationEntry, { kind: "parent" }>
        >();

        for (const command of this.values()) {
            if (command instanceof Command) {
                entries.push({ kind: "command", command });
                continue;
            }

            const name = this.parentNames.get(command);
            const parent = name ? this.parents.get(name) : undefined;

            if (!name || !parent)
                throw new Error(
                    `Subcommand in "${this.sources.get(command)}" has no parent definition.`,
                );

            let entry = parentEntries.get(name);

            if (!entry) {
                entry = {
                    kind: "parent",
                    name,
                    command: parent,
                    subcommands: [],
                    groups: new Collection(),
                };
                parentEntries.set(name, entry);
                entries.push(entry);
            }

            const groupName = this.groupNames.get(command);
            if (groupName === undefined) {
                entry.subcommands.push(command);
            } else {
                let group = entry.groups.get(groupName);
                if (!group) {
                    const definition = this.resolveGroup(name, groupName);
                    if (!definition)
                        throw new Error(
                            `Subcommand in "${this.sources.get(command)}" has no group definition.`,
                        );
                    group = {
                        parent: name,
                        name: groupName,
                        command: definition,
                        subcommands: [],
                    };
                    entry.groups.set(groupName, group);
                }
                group.subcommands.push(command);
            }
        }

        const registrations = entries.map(entry => {
            const definitions: CommandDefinition[] =
                entry.kind === "parent"
                    ? [
                          entry.command,
                          ...entry.subcommands,
                          ...[...entry.groups.values()].flatMap(group => [
                              group.command,
                              ...group.subcommands,
                          ]),
                      ]
                    : [entry.command];

            try {
                const body =
                    entry.kind === "parent"
                        ? entry.command.serialize(
                              entry.name,
                              entry.subcommands,
                              true,
                              [...entry.groups.values()].map(group =>
                                  group.command.compose(
                                      group.name,
                                      group.subcommands,
                                  ),
                              ),
                          )
                        : entry.command.builder.toJSON();
                return { body, definitions };
            } catch (cause) {
                const sources = definitions
                    .map(definition => this.sources.get(definition))
                    .filter(source => source !== undefined);
                throw new Error(
                    `Failed to serialize command builder${sources.length ? ` in ${sources.map(source => `"${source}"`).join(", ")}` : ""}.`,
                    { cause },
                );
            }
        });
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
                                const source = this.sources.get(definition);
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
