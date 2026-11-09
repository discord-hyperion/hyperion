import { defineEvent } from "@hyperion-js/core";
import { Embed, renderEmbed } from "@hyperion-js/jsx";
import { Events } from "discord.js";
export default defineEvent({
    event: Events.Invalidated,
    run: async ctx => {
        const embed = renderEmbed(
            <Embed>
                <Embed.Title>10</Embed.Title>
            </Embed>,
        );
        ctx.client.emit("consumer:jsx", embed.toJSON().title);
    },
});
