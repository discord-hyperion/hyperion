import { defineEvent } from "@hyperion/core";

export default defineEvent({
    event: "invalidated",
    run: async ctx => {
        ctx.client.emit("consumer:event", "second", ctx.args.length);
    },
});
