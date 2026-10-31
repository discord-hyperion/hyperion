import { ChatInputCommandBuilder } from "@discordjs/builders";
import { ParentCommand } from "@hyperion/core";
export default class extends ParentCommand {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder().setDescription("JSX parent"),
        });
    }
}
