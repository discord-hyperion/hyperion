import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineCommand } from "@hyperion/core";
export default defineCommand({
    builder: new ChatInputCommandBuilder()
        .setName("ping")
        .setDescription("Ping"),
    async run() {},
});
