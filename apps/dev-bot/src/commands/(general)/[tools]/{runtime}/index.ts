import { ChatInputCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { defineSubcommandGroup } from "@hyperion/core";

export default defineSubcommandGroup({
    builder: new ChatInputCommandSubcommandGroupBuilder().setDescription(
        "Inspect the development bot's runtime environment",
    ),
});
