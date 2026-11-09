import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion-js/core";
export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("ping")
        .setDescription("Ping"),
    run: async () => {},
});
