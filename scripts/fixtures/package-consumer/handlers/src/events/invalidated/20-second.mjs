import { defineEvent } from "@hyperion-js/core";

export default defineEvent({
    event: "invalidated",
    run: async ctx => {
        ctx.client.emit("consumer:event", "second", ctx.args.length);
    },
});
