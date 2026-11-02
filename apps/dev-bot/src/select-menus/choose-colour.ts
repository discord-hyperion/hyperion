import { StringSelectMenuBuilder } from "@discordjs/builders";
import { SelectMenu, type SelectMenuContext } from "@hyperion/core";

export default class ChooseColour extends SelectMenu {
    constructor() {
        super({
            builder: new StringSelectMenuBuilder()
                .setCustomId("colour.choose")
                .setPlaceholder("Choose a colour")
                .addOptions(
                    { label: "Blue", value: "blue" },
                    { label: "Green", value: "green" },
                    { label: "Red", value: "red" },
                ),
        });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `You chose ${ctx.interaction.values[0]}.`,
            allowedMentions: { parse: [] },
        });
    }
}
