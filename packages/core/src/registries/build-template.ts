import type { Collection } from "discord.js";
import type {
    CustomIdParams,
    ParamsDefinition,
    ParamValues,
} from "../components/custom-id-params.ts";
import { copyTemplate, type Template } from "../components/handler-options.ts";

type TemplatedHandler = {
    readonly builder?: Template | undefined;
    readonly params?: ParamsDefinition | undefined;
};

const sameKeys = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((key, i) => key === right[i]);

/**
 * A fresh copy of a handler's template with its custom ID set: a literal ID, or
 * a params definition and its values. The template itself never changes.
 */
export const buildTemplate = <Handler extends TemplatedHandler>(
    name: string,
    literal: Collection<string, Handler>,
    routes: Collection<string, Handler>,
    target: string | CustomIdParams,
    values?: ParamValues<readonly string[]>,
) => {
    let handler: Handler | undefined;
    let customId: string;

    if (typeof target === "string") {
        handler = literal.get(target);
        customId = target;

        if (!handler) {
            throw new Error(
                routes.has(target)
                    ? `The ${name} route "${target}" belongs to a params handler; build it from its params definition.`
                    : `No ${name} handler is loaded for custom ID "${target}".`,
            );
        }
    } else {
        handler = routes.get(target.id);

        if (!handler?.params) {
            throw new Error(
                `No ${name} params handler is loaded for route "${target.id}".`,
            );
        }
        if (!sameKeys(handler.params.keys, target.keys)) {
            throw new Error(
                `The ${name} params handler for "${target.id}" declares different keys than this definition.`,
            );
        }

        customId = target(values ?? {});
    }

    if (!handler.builder) {
        throw new Error(
            `The ${name} handler for "${handler.params?.id ?? customId}" has no template.`,
        );
    }

    return copyTemplate(handler.builder, customId) as NonNullable<
        Handler["builder"]
    >;
};
