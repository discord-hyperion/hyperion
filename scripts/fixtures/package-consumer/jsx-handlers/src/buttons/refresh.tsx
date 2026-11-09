import { defineButton } from "@hyperion-js/core";
import { Button, renderButton } from "@hyperion-js/jsx";

export default defineButton({
    builder: renderButton(
        <Button customId="consumer.refresh" style="primary">
            Refresh
        </Button>,
    ),
    run: async ctx => {
        await ctx.interaction.update({ content: "Refreshed" });
    },
});
