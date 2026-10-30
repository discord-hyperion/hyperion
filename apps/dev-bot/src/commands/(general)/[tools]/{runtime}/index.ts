import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { SubcommandGroup } from "@hyperion/core";

export default class Runtime extends SubcommandGroup {
    constructor() {
        super({
            builder:
                new ChatInputCommandSubcommandGroupBuilder().setDescription(
                    "Inspect the development bot's runtime environment",
                ),
        });
    }
}
