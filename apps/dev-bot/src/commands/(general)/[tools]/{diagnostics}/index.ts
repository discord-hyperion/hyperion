import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { SubcommandGroup } from "@hyperion/core";

export default class Diagnostics extends SubcommandGroup {
    constructor() {
        super({
            builder:
                new ChatInputCommandSubcommandGroupBuilder().setDescription(
                    "Check the development bot's runtime",
                ),
        });
    }
}
