import { SelectMenu, type SelectMenuContext } from "@hyperion/core";
import { renderStringSelect } from "@hyperion/jsx";
import { JsxPriority } from "../jsx-priority.tsx";

export default class extends SelectMenu {
    constructor() {
        super({ builder: renderStringSelect(<JsxPriority />) });
    }

    async run(ctx: SelectMenuContext) {
        await ctx.interaction.update({
            content: `Selected priority: ${ctx.interaction.values.join(", ") || "None"}. This demo does not store selections.`,
            allowedMentions: { parse: [] },
        });
    }
}
