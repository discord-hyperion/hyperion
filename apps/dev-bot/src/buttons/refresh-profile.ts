import {
    ActionRowBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
} from "@discordjs/builders";
import { Button, type ButtonContext, OwnerOnly } from "@hyperion/core";

export default class RefreshProfileButton extends Button {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder()
                .setCustomId("profile.refresh")
                .setLabel("Refresh profile"),
            guards: [new OwnerOnly()],
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.deferUpdate();

        const user = await ctx.client.users.fetch(ctx.interaction.user.id, {
            force: true,
        });

        // Clone the template so concurrent clicks never mutate a shared builder.
        const builder = new PrimaryButtonBuilder(this.builder.toJSON());
        const fetchedAt = new Intl.DateTimeFormat("en-SG", {
            timeZone: "Asia/Singapore",
            dateStyle: "medium",
            timeStyle: "medium",
            hour12: false,
        }).format(new Date());

        const timestamp = new SecondaryButtonBuilder()
            .setCustomId("profile.last-fetched")
            .setLabel(`Last fetched: ${fetchedAt} SGT`)
            .setDisabled(true);

        await ctx.interaction.editReply({
            content: `Profile refreshed: ${user.username}`,
            allowedMentions: { parse: [] },
            components: [
                new ActionRowBuilder().addComponents(builder, timestamp),
            ],
        });
    }
}
