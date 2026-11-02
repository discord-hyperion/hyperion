import { SelectMenu, type SelectMenuContext } from "@hyperion/core";
import { renderStringSelect, StringSelect } from "@hyperion/jsx";

export default class extends SelectMenu {
    constructor() {
        super({
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
