import { Events, type PartialMessage } from "discord.js";
import {
    type EventContext,
    EventHandler,
    type EventName,
} from "../src/index.ts";

class Ready extends EventHandler<Events.ClientReady> {
    async run(ctx: EventContext<Events.ClientReady>) {
        const [client] = ctx.args;
        client.user.id satisfies string;
        ctx.client.events.size satisfies number;
        // @ts-expect-error SDK readiness tuple has only one argument.
        ctx.args[1];
    }
}

class Update extends EventHandler<Events.MessageUpdate> {
    async run(ctx: EventContext<Events.MessageUpdate>) {
        const [oldMessage, newMessage] = ctx.args;
        oldMessage.id satisfies string;
        newMessage.content satisfies string;
        // @ts-expect-error The old message may be partial.
        oldMessage.content satisfies string;
        const partial: PartialMessage | typeof oldMessage = oldMessage;
        void partial;
    }
}

class Empty extends EventHandler<Events.Invalidated> {
    async run(ctx: EventContext<Events.Invalidated>) {
        ctx.args satisfies readonly [];
        // @ts-expect-error This event carries no arguments.
        ctx.args[0];
        // @ts-expect-error Event contexts are not interaction contexts.
        ctx.interaction;
        // @ts-expect-error The managed registry does not expose mutation.
        ctx.client.events.clear();
    }
}

// @ts-expect-error Custom application events are outside the initial scope.
type Custom = EventContext<"application:custom">;
// @ts-expect-error Event selection is filesystem metadata, not constructor options.
new Ready({ event: Events.ClientReady });
// @ts-expect-error Event names follow the SDK map and casing.
const wrongName: EventName = "client-ready";
class Wrong extends EventHandler<Events.ClientReady> {
    // @ts-expect-error The method context must match the class event type.
    async run(_ctx: EventContext<Events.Debug>) {}
}
void [Ready, Update, Empty, Wrong];

export type { Custom };

void wrongName;
