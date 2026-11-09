import { defineEvent } from "@hyperion/core";
import { Events } from "discord.js";

export default defineEvent({
    event: Events.MessageCreate,
    run: async ctx => {
        const [message] = ctx.args;
        console.log(`message was sent in ${message.channel.id}`);
    },
});
