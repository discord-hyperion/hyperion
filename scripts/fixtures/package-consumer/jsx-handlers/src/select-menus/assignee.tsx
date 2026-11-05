import { type SelectMenuContext, SelectMenuHandler } from "@hyperion/core";
import {
    RoleSelect,
    renderRoleSelect,
    renderUserSelect,
    UserSelect,
} from "@hyperion/jsx";
import { ComponentType } from "discord.js";

type AssigneeSpec = { componentType: ComponentType.UserSelect };

export default class extends SelectMenuHandler<AssigneeSpec> {
    constructor() {
        super({
            customId: "consumer.assignee",
            componentType: ComponentType.UserSelect,
            builder: renderUserSelect(
                <UserSelect customId="consumer.assignee" maxValues={1} />,
            ),
        });
    }

    async run(ctx: SelectMenuContext<AssigneeSpec>) {
        await ctx.interaction.update({
            content: `Assignee: ${ctx.interaction.values.join(",")}`,
        });
    }
}

export const mismatchedBuilder = () =>
    class extends SelectMenuHandler<AssigneeSpec> {
        constructor() {
            super({
                customId: "consumer.assignee",
                componentType: ComponentType.UserSelect,
                // @ts-expect-error A role-select template can't serve a user-select handler.
                builder: renderRoleSelect(
                    <RoleSelect customId="consumer.assignee" />,
                ),
            });
        }

        async run() {}
    };
