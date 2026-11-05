import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import { renderUserSelect, UserSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

type ChooseUserSpec = { componentType: ComponentType.UserSelect };

export default class ChooseUser extends SelectMenuHandler<ChooseUserSpec> {
    constructor() {
        super({
            customId: "user.choose",
            componentType: ComponentType.UserSelect,
            builder: renderUserSelect(
                <UserSelect
                    customId="user.choose"
                    placeholder="Choose a user"
                    minValues={1}
                    maxValues={1}
                />,
            ),
        });
    }

    async run(ctx: SelectMenuContext<ChooseUserSpec>) {
        const usernames = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected users: ${usernames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    }
}
