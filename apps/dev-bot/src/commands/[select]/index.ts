import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion-js/core";
import { InteractionContextType } from "discord.js";

// Role, mentionable, and channel menus need a server.
export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setDescription("Try each kind of select menu.")
        .setContexts(InteractionContextType.Guild),
});
