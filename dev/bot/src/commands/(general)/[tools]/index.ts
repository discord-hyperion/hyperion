import { ChatInputCommandBuilder } from "@discordjs/builders";
import { ParentCommand } from "@hyperion";
import { InteractionContextType } from "discord.js";

export default class Tools extends ParentCommand {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setDescription("Useful development utilities.")
                .setContexts(InteractionContextType.Guild),
        });
    }
}
