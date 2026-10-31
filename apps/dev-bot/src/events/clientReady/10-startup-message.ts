import { type EventContext, EventHandler } from "@hyperion/core";
import type { Events } from "discord.js";

export default class extends EventHandler<Events.ClientReady> {
    constructor() {
        super({ once: true });
    }

    async run(ctx: EventContext<Events.ClientReady>) {
        const [client] = ctx.args;
        ctx.logger.info(
            { userId: client.user.id },
            "Development bot startup event",
        );
    }
}
