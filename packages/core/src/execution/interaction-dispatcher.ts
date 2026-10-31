import {
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    Events,
    type Interaction,
    type MessageContextMenuCommandInteraction,
    MessageFlags,
    type UserContextMenuCommandInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";
import { Command, type CommandType, Subcommand } from "../commands/index.ts";
import {
    Modal,
    type SelectMenu,
    type SelectMenuType,
} from "../components/index.ts";
import type { AnyInteraction, InteractionContext } from "../contexts/index.ts";
import type { GuardProvider } from "../guards/index.ts";
import { GuardPipeline } from "./guard-pipeline.ts";
import { resolveCommandInput } from "./resolve-command-input.ts";
import { resolveModalInput } from "./resolve-modal-input.ts";

type HandlerKind = "command" | "button" | "select-menu" | "modal";

export type { AnyInteraction } from "../contexts/index.ts";

export class InteractionDispatcher {
    private readonly guards = new GuardPipeline();

    public constructor(private readonly client: HyperionClient) {}

    public attach() {
        this.client.on(Events.InteractionCreate, interaction =>
            this.dispatch(interaction),
        );
    }

    public async dispatch(interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            await this.dispatchCommand(interaction);
        } else if (interaction.isButton()) {
            const button = this.client.buttons.get(interaction.customId);
            // Unmatched IDs may belong to application-owned collectors/listeners.
            if (!button) return;

            const logger = this.createLogger(interaction, {
                button: button.customId,
            });

            await this.execute(
                button,
                { client: this.client, interaction, logger },
                "button",
            );
        } else if (interaction.isSelectMenu()) {
            const selectMenu = this.client.selectMenus.get(
                interaction.customId,
            );

            if (
                !selectMenu ||
                selectMenu.componentType !== interaction.componentType
            ) {
                return;
            }

            const logger = this.createLogger(interaction, {
                selectMenu: selectMenu.customId,
            });

            await this.execute(
                selectMenu as SelectMenu<SelectMenuType>,
                { client: this.client, interaction, logger },
                "select-menu",
            );
        } else if (interaction.isModalSubmit()) {
            const modal = this.client.modals.get(interaction.customId);

            if (!modal) return;

            const logger = this.createLogger(interaction, {
                modal: modal.customId,
            });

            await this.execute(
                modal,
                { client: this.client, interaction, logger },
                "modal",
            );
        } else if (interaction.isAutocomplete()) {
            await this.dispatchAutocomplete(interaction);
        } else if (interaction.isContextMenuCommand()) {
            await this.dispatchCommand(interaction);
        }
    }

    private async dispatchCommand(
        interaction:
            | ChatInputCommandInteraction
            | UserContextMenuCommandInteraction
            | MessageContextMenuCommandInteraction,
    ) {
        const subcommand = interaction.isChatInputCommand()
            ? this.subcommandName(interaction)
            : undefined;

        const group =
            interaction.isChatInputCommand() &&
            this.client.commands.hasSubcommands(interaction.commandName)
                ? (interaction.options.getSubcommandGroup(false) ?? undefined)
                : undefined;

        const logger = this.createLogger(interaction, {
            command: interaction.commandName,
            commandType: interaction.commandType,
            ...(subcommand ? { subcommand } : {}),
            ...(group ? { group } : {}),
        });

        if (
            interaction.isChatInputCommand() &&
            this.client.commands.hasSubcommands(interaction.commandName)
        ) {
            const command = subcommand
                ? this.client.commands.resolveSubcommand(
                      interaction.commandName,
                      subcommand,
                      group,
                  )
                : undefined;
            const parent = this.client.commands.parents.get(
                interaction.commandName,
            );

            if (!command || !parent) {
                await this.unavailableCommand(interaction, logger);
                return;
            }

            await this.execute(
                command,
                { client: this.client, interaction, logger },
                "command",
                [
                    ...parent.guards,
                    ...(group
                        ? (this.client.commands.resolveGroup(
                              interaction.commandName,
                              group,
                          )?.guards ?? [])
                        : []),
                ],
            );
            return;
        }

        const command = this.client.commands.resolve(
            interaction.commandName,
            interaction.commandType,
        );

        if (!command) {
            await this.unavailableCommand(interaction, logger);
            return;
        }

        await this.execute(
            command,
            { client: this.client, interaction, logger },
            "command",
        );
    }

    private async unavailableCommand(
        interaction:
            | ChatInputCommandInteraction
            | UserContextMenuCommandInteraction
            | MessageContextMenuCommandInteraction,
        logger: Logger,
    ) {
        logger.warn(
            { event: "command.unavailable" },
            "No handler found for command",
        );
        await this.respondWithError(
            interaction,
            "This command is no longer available. Please try again later.",
            logger,
            "command",
        );
    }

    private subcommandName(
        interaction: ChatInputCommandInteraction | AutocompleteInteraction,
    ) {
        if (!this.client.commands.hasSubcommands(interaction.commandName)) {
            return undefined;
        }

        return interaction.options.getSubcommand(false) ?? undefined;
    }

    private async dispatchAutocomplete(interaction: AutocompleteInteraction) {
        if (interaction.responded) return;

        const subcommand = this.subcommandName(interaction);

        const group = this.client.commands.hasSubcommands(
            interaction.commandName,
        )
            ? (interaction.options.getSubcommandGroup(false) ?? undefined)
            : undefined;

        const logger = this.createLogger(interaction, {
            command: interaction.commandName,
            ...(subcommand ? { subcommand } : {}),
            ...(group ? { group } : {}),
        });

        const command = subcommand
            ? this.client.commands.resolveSubcommand(
                  interaction.commandName,
                  subcommand,
                  group,
              )
            : this.client.commands.resolve(interaction.commandName);

        const started = performance.now();

        logger.debug({ event: "autocomplete.started" }, "Running autocomplete");

        if (typeof command?.autocomplete !== "function") {
            logger.debug(
                { event: "autocomplete.unavailable" },
                "No autocomplete handler found for command",
            );

            await this.respondWithEmptyAutocomplete(interaction, logger);
            return;
        }

        try {
            await command.autocomplete({
                client: this.client,
                interaction,
                logger,
            });

            await this.respondWithEmptyAutocomplete(interaction, logger);

            logger.debug(
                {
                    event: "autocomplete.completed",
                    durationMs: Math.round(performance.now() - started),
                },
                "Autocomplete completed",
            );
        } catch (err) {
            logger.error(
                {
                    event: "autocomplete.failed",
                    durationMs: Math.round(performance.now() - started),
                    err,
                },
                "Autocomplete execution failed",
            );

            await this.respondWithEmptyAutocomplete(interaction, logger);
        }
    }

    private async respondWithEmptyAutocomplete(
        interaction: AutocompleteInteraction,
        logger: Logger,
    ) {
        if (interaction.responded) return;

        try {
            await interaction.respond([]);
        } catch (err) {
            logger.error(
                { event: "autocomplete.response.failed", err },
                "Failed to send empty autocomplete choices",
            );
        }
    }

    private createLogger(
        interaction: AnyInteraction,
        handler:
            | {
                  command: string;
                  commandType?: CommandType;
                  subcommand?: string;
                  group?: string;
              }
            | { button: string }
            | { selectMenu: string }
            | { modal: string },
    ) {
        return this.client.logger.child({
            component: "execution",
            ...handler,
            interactionId: interaction.id,
            guildId: interaction.guildId,
            userId: interaction.user?.id,
        });
    }

    private async execute<Context extends InteractionContext>(
        handler: {
            readonly guards: readonly GuardProvider<Context>[];
            run: (ctx: Context) => Promise<void>;
        },
        ctx: Context,
        kind: HandlerKind,
        parentGuards: readonly GuardProvider<Context>[] = [],
    ) {
        const { interaction, logger } = ctx;
        const started = performance.now();

        logger.debug({ event: `${kind}.started` }, `Running ${kind}`);

        let stage: "guards" | "input" | "handler" = "guards";

        try {
            const result = await this.guards.run(
                [...parentGuards, ...handler.guards],
                ctx,
            );

            if (!result.passed) {
                logger.info(
                    {
                        event: `${kind}.rejected`,
                        guard: result.guard.name,
                        durationMs: Math.round(performance.now() - started),
                    },
                    `${kind} rejected by guard`,
                );
                if (result.guard.onFail) {
                    await result.guard.onFail(ctx);
                } else {
                    await this.respondWithError(
                        interaction,
                        result.guard.description,
                        logger,
                        kind,
                    );
                }
                return;
            }

            let handlerContext = ctx;
            if (
                (handler instanceof Command || handler instanceof Subcommand) &&
                interaction.isChatInputCommand() &&
                handler.input
            ) {
                stage = "input";
                const input = await resolveCommandInput(handler, {
                    ...ctx,
                    interaction,
                });
                handlerContext = { ...ctx, input };
            } else if (
                handler instanceof Modal &&
                interaction.isModalSubmit() &&
                handler.input
            ) {
                stage = "input";

                const input = await resolveModalInput(handler, {
                    ...ctx,
                    interaction,
                });
                handlerContext = { ...ctx, input };
            }

            stage = "handler";
            await handler.run(handlerContext);

            logger.info(
                {
                    event: `${kind}.completed`,
                    durationMs: Math.round(performance.now() - started),
                },
                `${kind} completed`,
            );
        } catch (err) {
            logger.error(
                {
                    event: `${kind}.failed`,
                    stage,
                    durationMs: Math.round(performance.now() - started),
                    err,
                },
                `${kind} execution failed`,
            );

            await this.respondWithError(
                interaction,
                `Something went wrong while running this ${kind === "select-menu" ? "select menu" : kind}.`,
                logger,
                kind,
            );
        }
    }

    private async respondWithError(
        interaction: InteractionContext["interaction"],
        content: string,
        logger: Logger,
        kind: HandlerKind,
    ) {
        try {
            // deferUpdate() leaves ephemeral null: editing its reply would replace
            // the source message. Send a private follow-up in that state instead.
            const deferredUpdate =
                kind !== "command" &&
                interaction.deferred &&
                interaction.ephemeral === null;
            if (interaction.replied || deferredUpdate) {
                await interaction.followUp({
                    content,
                    flags: MessageFlags.Ephemeral,
                });
            } else if (interaction.deferred) {
                await interaction.editReply({ content });
            } else {
                await interaction.reply({
                    content,
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (err) {
            logger.error(
                { event: `${kind}.error-response.failed`, err },
                `Failed to send ${kind} error response`,
            );
        }
    }
}
