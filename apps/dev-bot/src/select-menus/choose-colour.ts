import { StringSelectMenuBuilder } from "@discordjs/builders";
import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { ComponentType } from "discord.js";

export default class ChooseColour extends SelectMenuHandler {
    constructor() {
        super({
            customId: "colour.choose",
            componentType: ComponentType.StringSelect,
            builder: new StringSelectMenuBuilder()
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
