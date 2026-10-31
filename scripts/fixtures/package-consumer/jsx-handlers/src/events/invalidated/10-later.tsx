import { type EventContext, EventHandler } from "@hyperion/core";
import { Embed, renderEmbed } from "@hyperion/jsx";
import type { Events } from "discord.js";
export default class extends EventHandler<Events.Invalidated> {
    async run(ctx: EventContext<Events.Invalidated>) {
        const embed = renderEmbed(
            <Embed>
                <Embed.Title>10</Embed.Title>
            </Embed>,
        );
        ctx.client.emit("consumer:jsx", embed.toJSON().title);
    }
}
