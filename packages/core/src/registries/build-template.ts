import type { Collection } from "discord.js";
import { copyTemplate, type Template } from "../components/handler-options.ts";

type TemplatedHandler = { readonly builder?: Template | undefined };

/** A fresh copy of a literal handler's template; throws when there is none. */
export const buildTemplate = <Handler extends TemplatedHandler>(
    name: string,
    literal: Collection<string, Handler>,
    routes: Collection<string, Handler> | undefined,
    customId: string,
) => {
    const handler = literal.get(customId);
    if (!handler) {
        throw new Error(
            routes?.has(customId)
                ? `The ${name} route "${customId}" belongs to a params handler; set its custom ID with the params encoder.`
                : `No ${name} handler is loaded for custom ID "${customId}".`,
        );
    }
    if (!handler.builder) {
        throw new Error(
            `The ${name} handler for "${customId}" has no template.`,
        );
    }

    return copyTemplate(handler.builder, customId) as NonNullable<
        Handler["builder"]
    >;
};
