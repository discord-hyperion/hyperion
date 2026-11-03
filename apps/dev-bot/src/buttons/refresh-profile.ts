import {
    ActionRowBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
} from "@discordjs/builders";
import { type ButtonContext, ButtonHandler, ownerOnly } from "@hyperion/core";

export default class RefreshProfileButton extends ButtonHandler {
    constructor() {
        super({
            customId: "profile.refresh",
            builder: new PrimaryButtonBuilder().setLabel("Refresh profile"),
            guards: [ownerOnly],
        });
    }

    async run(ctx: ButtonContext) {
        await ctx.interaction.deferUpdate();

        const user = await ctx.client.users.fetch(ctx.interaction.user.id, {
            force: true,
        });

        // build() returns a fresh copy, so clicks never mutate the shared template.
        const builder = ctx.client.buttons.build(this.customId);
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
