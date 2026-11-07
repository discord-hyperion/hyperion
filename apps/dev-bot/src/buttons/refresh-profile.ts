import {
    ActionRowBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
} from "@discordjs/builders";
import { defineButton, ownerOnly } from "@hyperion/core";

const refreshProfile = defineButton({
    builder: new PrimaryButtonBuilder()
        .setCustomId("profile.refresh")
        .setLabel("Refresh profile"),
    guards: [ownerOnly],
    async run(ctx) {
        await ctx.interaction.deferUpdate();

        const user = await ctx.client.users.fetch(ctx.interaction.user.id, {
            force: true,
        });

        // build() returns a fresh copy, so clicks never mutate the shared template.
        const builder = ctx.client.buttons.build(refreshProfile.customId);
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
    },
});

export default refreshProfile;
