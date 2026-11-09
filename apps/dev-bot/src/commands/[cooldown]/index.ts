import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion-js/core";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder().setDescription(
        "Try in-memory and SQLite-backed cooldowns.",
    ),
});
