import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion/core";
import { InteractionContextType } from "discord.js";

export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setDescription("Useful development utilities.")
        .setContexts(InteractionContextType.Guild),
});
