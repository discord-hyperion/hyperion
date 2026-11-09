import { defineEvent } from "@hyperion/core";

export default defineEvent({
    event: "invalidated",
    run: async ctx => {
        ctx.client.emit("consumer:event", "first", ctx.args.length);
    },
});
