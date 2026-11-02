import { type EventContext, EventHandler } from "@hyperion/core";
import type { Events } from "discord.js";

export default class extends EventHandler<Events.MessageCreate> {
    async run(ctx: EventContext<Events.MessageCreate>): Promise<void> {
        const [message] = ctx.args;
        console.log(`message was sent in ${message.channel.id}`);
    }
}
