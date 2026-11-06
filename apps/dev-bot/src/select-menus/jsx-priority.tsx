import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { renderStringSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";
import { JsxPriority } from "../views/jsx-priority.tsx";

export default class extends SelectMenuHandler {
    constructor() {
        super({
            componentType: ComponentType.StringSelect,
            builder: renderStringSelect(<JsxPriority />),
        });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `Selected priority: ${ctx.interaction.values.join(", ") || "None"}. This demo does not store selections.`,
            allowedMentions: { parse: [] },
        });
    }
}
