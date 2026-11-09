import { defineSelectMenu } from "@hyperion-js/core";
import {
    RoleSelect,
    renderRoleSelect,
    renderUserSelect,
    UserSelect,
} from "@hyperion-js/jsx";
import { ComponentType } from "discord.js";

export default defineSelectMenu({
    componentType: ComponentType.UserSelect,
    builder: renderUserSelect(
        <UserSelect customId="consumer.assignee" maxValues={1} />,
    ),
    run: async ctx => {
        await ctx.interaction.update({
            content: `Assignee: ${ctx.interaction.values.join(",")}`,
        });
    },
});

export const mismatchedBuilder = () =>
    defineSelectMenu({
        componentType: ComponentType.UserSelect,
        // @ts-expect-error A role-select template can't serve a user-select handler.
        builder: renderRoleSelect(<RoleSelect customId="consumer.assignee" />),
        run: async () => {},
    });
