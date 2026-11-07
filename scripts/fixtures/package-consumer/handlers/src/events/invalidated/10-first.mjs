import { defineEvent } from "@hyperion/core";

export default defineEvent({
    event: "invalidated",
    async run(ctx) {
        ctx.client.emit("consumer:event", "first", ctx.args.length);
    },
});
