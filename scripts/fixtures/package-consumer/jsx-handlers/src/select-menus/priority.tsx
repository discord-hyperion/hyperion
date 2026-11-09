import { defineSelectMenu } from "@hyperion-js/core";
import { renderStringSelect, StringSelect } from "@hyperion-js/jsx";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.StringSelect,
    builder: renderStringSelect(
        <StringSelect customId="consumer.priority">
            <StringSelect.Option label="Low" value="low" />
            <StringSelect.Option label="High" value="high" />
        </StringSelect>,
    ),
    run: async ctx => {
        ctx.interaction.values satisfies readonly string[];
        await ctx.interaction.update({
            content: `Priority: ${ctx.interaction.values.join(",")}`,
        });
    },
});
