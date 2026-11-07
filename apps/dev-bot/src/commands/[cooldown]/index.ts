import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion/core";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder().setDescription(
        "Try in-memory and SQLite-backed cooldowns.",
    ),
});
