import { EventHandler } from "@hyperion/core";

export default class extends EventHandler {
    async run(ctx) {
        ctx.client.emit("consumer:event", "first", ctx.args.length);
    }
}
