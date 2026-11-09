import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { defineSubcommandGroup } from "@hyperion-js/core";

export default defineSubcommandGroup({
    builder: new ChatInputCommandSubcommandGroupBuilder().setDescription(
        "Inspect the development bot's runtime environment",
    ),
});
