import { defineEvent } from "@hyperion-js/core";

export default defineEvent({
    event: "invalidated",
    run: async ctx => {
        ctx.client.emit("consumer:event", "first", ctx.args.length);
    },
});
