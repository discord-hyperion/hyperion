import type { Collection } from "discord.js";
import {
    decodeParams,
    type ParamsDefinition,
} from "../components/custom-id-params.ts";

type RoutedHandler = { readonly params?: ParamsDefinition | undefined };

/**
 * Exact custom ID first, then a params route. `accepts` runs before decoding so
 * a handler of the wrong kind never reaches its schema. Undefined when unmatched.
 */
export const resolveRoute = <Handler extends RoutedHandler>(
    literal: Collection<string, Handler>,
    routes: Collection<string, Handler>,
    customId: string,
    accepts: (handler: Handler) => boolean = () => true,
) => {
    const exact = literal.get(customId);
    if (exact) {
        return accepts(exact) ? { handler: exact, raw: undefined } : undefined;
    }

    const handler = routes.get(customId.split(":")[0] ?? "");
    if (!handler?.params || !accepts(handler)) return undefined;

    const raw = decodeParams(handler.params, customId);

    return raw ? { handler, raw } : undefined;
};
