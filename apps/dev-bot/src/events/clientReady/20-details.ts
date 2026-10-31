import { type EventContext, EventHandler } from "@hyperion/core";
import type { Events } from "discord.js";

export default class extends EventHandler<Events.ClientReady> {
    constructor() {
        super({ once: true });
    }

    async run(ctx: EventContext<Events.ClientReady>) {
        ctx.logger.info(
            {
                commandCount: ctx.client.commands.size,
                eventHandlerCount: ctx.client.events.size,
            },
            "Development bot startup details",
        );
    }
}
