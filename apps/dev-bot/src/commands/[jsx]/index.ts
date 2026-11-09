import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion-js/core";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder().setDescription(
        "Try messages, controls, and forms authored with JSX.",
    ),
});
