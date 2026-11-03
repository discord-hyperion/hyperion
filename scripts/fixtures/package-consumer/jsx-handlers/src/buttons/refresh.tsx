import { type ButtonContext, ButtonHandler } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default class extends ButtonHandler {
    constructor() {
        super({
            customId: "consumer.refresh",
            builder: renderButton(
                <Button customId="consumer.refresh" style="primary">
                    Refresh
                </Button>,
            ),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.update({ content: "Refreshed" });
    }
}
