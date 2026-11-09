import { defineEvent } from "@hyperion/core";
import { Events } from "discord.js";

export default defineEvent({
    event: Events.ClientReady,
    once: true,
    run: async ctx => {
        ctx.logger.info(
            {
                commandCount: ctx.client.commands.size,
                eventHandlerCount: ctx.client.events.size,
            },
            "Development bot startup details",
        );
    },
});
