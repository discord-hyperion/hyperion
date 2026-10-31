import { EventHandler } from "@hyperion/core";
import { Embed, renderEmbed } from "@hyperion/jsx";
export default class extends EventHandler {
    async run(ctx) {
        const embed = renderEmbed(
            <Embed>
                <Embed.Title>2</Embed.Title>
            </Embed>,
        );
        ctx.client.emit("consumer:jsx", embed.toJSON().title);
    }
}
