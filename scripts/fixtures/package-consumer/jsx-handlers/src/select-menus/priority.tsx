import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { renderStringSelect, StringSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

export default class extends SelectMenuHandler {
    constructor() {
        super({
            componentType: ComponentType.StringSelect,
            builder: renderStringSelect(
                <StringSelect customId="consumer.priority">
                    <StringSelect.Option label="Low" value="low" />
                    <StringSelect.Option label="High" value="high" />
                </StringSelect>,
            ),
        });
    }

    async run(ctx: SelectMenuContext) {
        ctx.interaction.values satisfies readonly string[];
        await ctx.interaction.update({
            content: `Priority: ${ctx.interaction.values.join(",")}`,
        });
    }
}
