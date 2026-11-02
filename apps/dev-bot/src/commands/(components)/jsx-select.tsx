import { ChatInputCommandBuilder } from "@discordjs/builders";
import { Command, type CommandContext } from "@hyperion/core";
import { ActionRow, renderComponents } from "@hyperion/jsx";
import { JsxPriority } from "../../views/jsx-priority.tsx";

export default class extends Command {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("jsx-select")
                .setDescription("Show a JSX-authored priority select menu.")
                .addStringOptions(option =>
                    option
                        .setName("priority")
                        .setDescription("Initially selected priority.")
                        .addChoices(
                            { name: "Low", value: "low" },
                            { name: "High", value: "high" },
                        ),
                )
                .addBooleanOptions(option =>
                    option
                        .setName("disabled")
                        .setDescription("Disable the menu."),
                ),
        });
    }

    async run(ctx: CommandContext) {
        const current = ctx.interaction.options.getString("priority") ?? "low";
        const disabled =
            ctx.interaction.options.getBoolean("disabled") ?? false;
        const components = renderComponents(
            <ActionRow>
                <JsxPriority current={current} disabled={disabled} />
            </ActionRow>,
        );

        await ctx.interaction.reply({
            content: "JSX string-select demo",
            components,
        });
    }
}
