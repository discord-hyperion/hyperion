import type { Collection } from "discord.js";
import type { Logger } from "pino";
import {
    decodeParams,
    type ParamsDefinition,
} from "../components/custom-id-params.ts";

type RoutedHandler = { readonly params?: ParamsDefinition | undefined };

const separator = ":";

/**
 * Exact custom ID first, then a params route. `accepts` runs before decoding so
 * a handler of the wrong kind never reaches its schema. Undefined when unmatched.
 */
export const resolveRoute = <Handler extends RoutedHandler>(
    literal: Collection<string, Handler>,
    routes: Collection<string, Handler>,
    customId: string,
    {
        accepts = () => true,
        logger,
        kind,
    }: {
        accepts?: (handler: Handler) => boolean;
        logger?: Logger | undefined;
        kind: string;
    },
) => {
    const exact = literal.get(customId);

    if (exact) {
        return accepts(exact) ? { handler: exact, raw: undefined } : undefined;
    }

    const segments = customId.split(separator);
    const route = segments[0] ?? "";
    const handler = routes.get(route);
    if (!handler?.params || !accepts(handler)) return undefined;

    const raw = decodeParams(handler.params, customId);

    if (!raw) {
        // A matched route that fails to decode is usually a template sent
        // without values or a stale control. Log the route and counts only.
        logger?.debug(
            {
                event: `${kind}.params.undecodable`,
                route,
                segments: segments.length - 1,
                expected: handler.params.keys.length,
            },
            "Custom ID matched a params route but could not be decoded",
        );

        return undefined;
    }

    return { handler, raw };
};
