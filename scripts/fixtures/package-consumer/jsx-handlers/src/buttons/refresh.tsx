import { defineButton } from "@hyperion/core";
import { Button, renderButton } from "@hyperion/jsx";

export default defineButton({
    builder: renderButton(
        <Button customId="consumer.refresh" style="primary">
            Refresh
        </Button>,
    ),
    async run(ctx) {
        await ctx.interaction.update({ content: "Refreshed" });
    },
});
