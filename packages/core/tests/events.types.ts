import { Events, type PartialMessage } from "discord.js";
import {
    defineEvent,
    type EventContext,
    type EventName,
} from "../src/index.ts";

const Ready = defineEvent({
    event: Events.ClientReady,
    async run(ctx) {
        const [client] = ctx.args;
        client.user.id satisfies string;
        ctx.client.events.size satisfies number;
        // @ts-expect-error SDK readiness tuple has only one argument.
        ctx.args[1];
    },
});

const Update = defineEvent({
    event: Events.MessageUpdate,
    async run(ctx) {
        const [oldMessage, newMessage] = ctx.args;
        oldMessage.id satisfies string;
        newMessage.content satisfies string;
        // @ts-expect-error The old message may be partial.
        oldMessage.content satisfies string;
        const partial: PartialMessage | typeof oldMessage = oldMessage;
        void partial;
    },
});

const Empty = defineEvent({
    event: Events.Invalidated,
    async run(ctx) {
        ctx.args satisfies readonly [];
        // @ts-expect-error This event carries no arguments.
        ctx.args[0];
        // @ts-expect-error Event contexts are not interaction contexts.
        ctx.interaction;
        // @ts-expect-error The managed registry does not expose mutation.
        ctx.client.events.clear();
    },
});

// @ts-expect-error Custom application events are outside the initial scope.
type Custom = EventContext<"application:custom">;
// @ts-expect-error Event names follow the SDK map and casing.
const wrongName: EventName = "client-ready";
const Wrong = defineEvent({
    // @ts-expect-error The run context must match the named event.
    event: Events.ClientReady,
    async run(_ctx: EventContext<Events.Debug>) {},
});
void [Ready, Update, Empty, Wrong];

export type { Custom };

void wrongName;
