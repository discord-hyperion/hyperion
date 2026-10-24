import {
    type ChatInputCommandInteraction,
    Events,
    type Interaction,
    MessageFlags,
} from "discord.js";
import type { Logger } from "pino";
import type { HyperionClient } from "../client/index.ts";
import { GuardPipeline } from "./guard-pipeline.ts";

export class InteractionDispatcher {
    private readonly guards = new GuardPipeline();

    public constructor(private readonly client: HyperionClient) {}

    public attach(): void {
        this.client.on(Events.InteractionCreate, interaction =>
            this.dispatch(interaction),
        );
    }

    public async dispatch(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const logger = this.client.logger.child({
            component: "execution",
            command: interaction.commandName,
            interactionId: interaction.id,
            guildId: interaction.guildId,
            userId: interaction.user?.id,
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
            );
            return;
        }

        const started = performance.now();
        logger.debug({ event: "command.started" }, "Running command");
        let stage: "guards" | "handler" = "guards";
        try {
            const ctx = { client: this.client, interaction, logger };
            const result = await this.guards.run(command.guards, ctx);

            if (!result.passed) {
                logger.info(
                    {
                        event: "command.rejected",
                        guard: result.guard.name,
                        durationMs: Math.round(performance.now() - started),
                    },
                    "Command rejected by guard",
                );
                if (result.guard.onFail) {
                    await result.guard.onFail(ctx);
                } else {
                    await this.respondWithError(
                        interaction,
                        result.guard.description,
                        logger,
                    );
                }
                return;
            }

            stage = "handler";
            await command.run(ctx);
            logger.info(
                {
                    event: "command.completed",
                    durationMs: Math.round(performance.now() - started),
                },
                "Command completed",
            );
        } catch (err) {
            logger.error(
                {
                    event: "command.failed",
                    stage,
                    durationMs: Math.round(performance.now() - started),
                    err,
                },
                "Command execution failed",
            );
            await this.respondWithError(
                interaction,
                "Something went wrong while running this command.",
                logger,
            );
        }
    }

    private async respondWithError(
        interaction: ChatInputCommandInteraction,
        content: string,
        logger: Logger,
    ): Promise<void> {
        try {
            if (interaction.replied) {
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
                { event: "command.error-response.failed", err },
                "Failed to send command error response",
            );
        }
    }
}
