import { defineEvent } from "@hyperion/core";
import { Embed, renderEmbed } from "@hyperion/jsx";
export default defineEvent({
    event: "invalidated",
    run: async ctx => {
        const embed = renderEmbed(
            <Embed>
                <Embed.Title>2</Embed.Title>
            </Embed>,
        );
        ctx.client.emit("consumer:jsx", embed.toJSON().title);
    },
});
