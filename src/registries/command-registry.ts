import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection, DiscordAPIError, REST, Routes } from "discord.js";
import type { Logger } from "pino";
import { Command } from "../commands/index.ts";
import { assertRegistryClass, discoverModules } from "../util/index.ts";

export interface CommandRegistrationOptions {
    applicationId: string;
    token: string;
    /** Omit for global registration; provide guild IDs for development. */
    guildIds?: readonly string[];
}

export class CommandRegistry extends Collection<string, Command> {
    private sources = new WeakMap<Command, string>();

    public constructor(private readonly logger?: Logger) {
        super();
    }

    public async load(root: string | URL = process.cwd()) {
        const rootPath =
            root instanceof URL ? fileURLToPath(root) : path.resolve(root);
        const directoryPath = path.join(rootPath, "src", "commands");

        this.logger?.debug(
            { event: "commands.discover", directory: directoryPath },
            "Discovering command files",
        );

        const files = await discoverModules(directoryPath, () => {
            this.logger?.debug(
                {
                    event: "commands.directory.missing",
                    directory: directoryPath,
                },
                "Optional command directory does not exist",
            );
        });

        const commands = new Collection<string, Command>();
        const sources = new WeakMap<Command, string>();

        for (const file of files) {
            let command: Command;

            try {
                const module = await import(pathToFileURL(file).href);
                const CommandClass = module.default;

                assertRegistryClass(CommandClass, Command);

                command = new CommandClass();
            } catch (cause) {
                throw new Error(`Failed to load command from "${file}".`, {
                    cause,
                });
            }

            if (typeof command.builder?.toJSON !== "function") {
                throw new Error(
                    `Command in "${file}" must provide a command builder.`,
                );
            }

            const name = command.builder.toJSON(false).name;

            if (typeof name !== "string" || typeof command.run !== "function") {
                throw new Error(
                    `Command in "${file}" must provide a named builder and a run() method.`,
                );
            }

            if (
                command.autocomplete !== undefined &&
                typeof command.autocomplete !== "function"
            ) {
                throw new Error(
                    `Command in "${file}" must provide an autocomplete() method when configured.`,
                );
            }

            if (commands.has(name)) {
                throw new Error(
                    `Duplicate command name "${name}" in "${file}".`,
                );
            }

            commands.set(name, command);
            sources.set(command, file);

            this.logger?.debug(
                { event: "command.loaded", command: name, source: file },
                "Loaded command",
            );
        }

        this.clear();
        this.sources = sources;

        for (const [name, command] of commands) {
            this.set(name, command);
        }

        this.logger?.info(
            { event: "commands.loaded", count: this.size },
            "Command discovery complete",
        );
    }

    /** Replaces all application commands in each selected scope. */
    public async register(options: CommandRegistrationOptions) {
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

        const rest = new REST({ version: "10" }).setToken(options.token);
        const commands = [...this.values()];

        const body = commands.map(command => {
            try {
                return command.builder.toJSON();
            } catch (cause) {
                const source = this.sources.get(command);
                throw new Error(
                    `Failed to serialize command builder${source ? ` in "${source}"` : ""}.`,
                    { cause },
                );
            }
        });

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
                        for (const k of Object.keys(errors)) {
                            if (!/^\d+$/.test(k)) continue;

                            const key = Number(k);
                            const command = commands[key];

                            if (!command) continue;

                            const source = this.sources.get(command);
                            sources.push(
                                `body[${key}]: "${body[key]?.name}"${source ? ` (${source})` : ""}`,
                            );
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
