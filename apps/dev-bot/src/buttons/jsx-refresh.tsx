import { type ButtonContext, ButtonHandler } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default class extends ButtonHandler {
    constructor() {
        super({
            builder: renderButton(
                <Button
                    customId="jsx.refresh"
                    style="primary"
                    emoji={{ name: "🔄" }}
                >
                    Refresh JSX demo
                </Button>,
            ),
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.update({
            content: "JSX button handled through the existing button registry.",
        });
    }
}
