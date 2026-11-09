import { defineButton } from "@hyperion-js/core";
import { Button, renderButton } from "@hyperion-js/jsx";

export default defineButton({
    builder: renderButton(
        <Button customId="jsx.refresh" style="primary" emoji={{ name: "🔄" }}>
            Refresh JSX demo
        </Button>,
    ),
    run: async ctx => {
        await ctx.interaction.update({
            content: "JSX button handled through the existing button registry.",
        });
    },
});
