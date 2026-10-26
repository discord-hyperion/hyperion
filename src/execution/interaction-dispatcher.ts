import {
    type AutocompleteInteraction,
    Events,
    type Interaction,
    MessageFlags,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";
import type { SelectMenu, SelectMenuType } from "../components/index.ts";
import type { AnyInteraction, InteractionContext } from "../contexts/index.ts";
import type { GuardProvider } from "../guards/index.ts";
import { GuardPipeline } from "./guard-pipeline.ts";

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
            const logger = this.createLogger(interaction, {
                command: interaction.commandName,
            });

            const command = this.client.commands.get(interaction.commandName);

            if (!command) {
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

                return;
            }
            await this.execute(
                command,
                {
                    client: this.client,
                    interaction,
                    logger,
                },
                "command",
            );
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
        } else if (
            interaction.isStringSelectMenu() ||
            interaction.isUserSelectMenu() ||
            interaction.isRoleSelectMenu() ||
            interaction.isMentionableSelectMenu() ||
            interaction.isChannelSelectMenu()
        ) {
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
        }
    }

    private async dispatchAutocomplete(interaction: AutocompleteInteraction) {
        if (interaction.responded) return;

        const logger = this.createLogger(interaction, {
            command: interaction.commandName,
        });
        const command = this.client.commands.get(interaction.commandName);
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
            | { command: string }
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
    ) {
        const { interaction, logger } = ctx;
        const started = performance.now();

        logger.debug({ event: `${kind}.started` }, `Running ${kind}`);

        let stage: "guards" | "handler" = "guards";

        try {
            const result = await this.guards.run(handler.guards, ctx);

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

            stage = "handler";
            await handler.run(ctx);

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
