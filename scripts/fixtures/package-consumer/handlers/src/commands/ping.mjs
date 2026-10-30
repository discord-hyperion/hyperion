import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command } from "@hyperion/core";
export default class extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("ping")
                .setDescription("Ping"),
        });
    }
    async run() {}
}
