import { defineSelectMenu } from "@hyperion/core";
import { renderUserSelect, UserSelect } from "@hyperion/jsx";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    builder: renderUserSelect(
        <UserSelect
            customId="user.choose"
            placeholder="Choose a user"
            minValues={1}
            maxValues={1}
        />,
    ),
    run: async ctx => {
        const usernames = ctx.interaction.users.map(user => user.username);

        await ctx.interaction.update({
            content: `Selected users: ${usernames.join(", ") || "None"}.`,
            allowedMentions: { parse: [] },
        });
    },
});
