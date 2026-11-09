import { defineEvent } from "@hyperion/core";
import { Events } from "discord.js";

export default defineEvent({
    event: Events.ClientReady,
    once: true,
    run: async ctx => {
        const [client] = ctx.args;
        ctx.logger.info(
            { userId: client.user.id },
            "Development bot startup event",
        );
    },
});
