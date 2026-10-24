import {
    type ChatInputCommandInteraction,
    Events,
    type Interaction,
    MessageFlags,
} from "discord.js";
import type { HyperionClient } from "../client/index.ts";

export class InteractionDispatcher {
    public constructor(private readonly client: HyperionClient) {}

    public attach(): void {
        this.client.on(Events.InteractionCreate, interaction =>
            this.dispatch(interaction),
        );
    }

    public async dispatch(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const command = this.client.commands.get(interaction.commandName);
        if (!command) {
            await this.respondWithError(
                interaction,
                "This command is no longer available. Please try again later.",
            );
            return;
        }

        try {
            await command.run({ client: this.client, interaction });
        } catch (error) {
            console.error(
                `Command "${interaction.commandName}" failed (interaction ${interaction.id}).`,
                error,
            );
            await this.respondWithError(
                interaction,
                "Something went wrong while running this command.",
            );
        }
    }

    private async respondWithError(
        interaction: ChatInputCommandInteraction,
        content: string,
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
        } catch (error) {
            console.error(
                `Failed to send an error response for command "${interaction.commandName}" (interaction ${interaction.id}).`,
                error,
            );
        }
    }
}
