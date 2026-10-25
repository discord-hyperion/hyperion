import {
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    ComponentType,
    Events,
    type Interaction,
    MessageFlags,
    type StringSelectMenuInteraction,
    type UserSelectMenuInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";
import type { InteractionContext } from "../contexts/index.ts";
import type { GuardProvider } from "../guards/index.ts";
import { GuardPipeline } from "./guard-pipeline.ts";

type HandlerKind = "command" | "button" | "select-menu";

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
            interaction.isUserSelectMenu()
        ) {
            const selectMenu = this.client.selectMenus.get(
                interaction.customId,
            );

            if (!selectMenu) return;

            const logger = this.createLogger(interaction, {
                selectMenu: selectMenu.customId,
            });

            if (
                selectMenu.componentType === ComponentType.StringSelect &&
                interaction.isStringSelectMenu()
            ) {
                await this.execute(
                    selectMenu,
                    { client: this.client, interaction, logger },
                    "select-menu",
                );
            } else if (
                selectMenu.componentType === ComponentType.UserSelect &&
                interaction.isUserSelectMenu()
            ) {
                await this.execute(
                    selectMenu,
                    { client: this.client, interaction, logger },
                    "select-menu",
                );
            }
        }
    }

    private createLogger(
        interaction:
            | ChatInputCommandInteraction
            | ButtonInteraction
            | StringSelectMenuInteraction
            | UserSelectMenuInteraction,
        handler:
            | { command: string }
            | { button: string }
            | { selectMenu: string },
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
            run(ctx: Context): Promise<void>;
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
        interaction:
            | ChatInputCommandInteraction
            | ButtonInteraction
            | StringSelectMenuInteraction
            | UserSelectMenuInteraction,
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
