import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { SubcommandGroup } from "@hyperion";

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
