import { ChatInputCommandSubcommandBuilder } from "@discordjs/builders";
import { defineSubcommand } from "@hyperion/core";
import { renderComponents } from "@hyperion/jsx";
import { JsxControls } from "../../views/jsx-controls.tsx";

export default defineSubcommand({
    builder: new ChatInputCommandSubcommandBuilder()
        .setName("buttons")
        .setDescription(
            "Show JSX-authored buttons with native handler routing.",
        )
        .addBooleanOptions(option =>
            option
                .setName("disabled")
                .setDescription("Disable the demo button."),
        ),
    async run(ctx) {
        const disabled =
            ctx.interaction.options.getBoolean("disabled") ?? false;
        const components = renderComponents(
            <JsxControls disabled={disabled} />,
        );

        await ctx.interaction.reply({ content: "JSX button demo", components });
    },
});
