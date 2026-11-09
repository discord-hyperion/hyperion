import { defineSelectMenu } from "@hyperion-js/core";
import { renderStringSelect } from "@hyperion-js/jsx";
import { ComponentType } from "discord.js";
import { JsxPriority } from "../views/jsx-priority.tsx";

export default defineSelectMenu({
    componentType: ComponentType.StringSelect,
    builder: renderStringSelect(<JsxPriority />),
    run: async ctx => {
        await ctx.interaction.update({
            content: `Selected priority: ${ctx.interaction.values.join(", ") || "None"}. This demo does not store selections.`,
            allowedMentions: { parse: [] },
        });
    },
});
