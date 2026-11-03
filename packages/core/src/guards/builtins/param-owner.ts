import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { InteractionContext } from "../../contexts/index.ts";
import { defineGuard } from "../guard.ts";

/** Any context whose custom-ID params carry `Key` as a string. */
export type ParamOwnerContext<Key extends string> = InteractionContext & {
    readonly params:
        | readonly [issues: null, params: { readonly [K in Key]: string }]
        | readonly [
              issues: readonly StandardSchemaV1.Issue[],
              params: undefined,
          ];
};

/**
 * Rejects unless the user equals the custom-ID param `key`. Custom IDs are
 * client-controlled, so params that fail validation are always rejected.
 */
export const paramOwner = <Key extends string>(
    key: Key,
    description = "Only the person this was sent for can use it.",
) =>
    defineGuard<ParamOwnerContext<Key>>({
        name: "param-owner",
        description,
        run: ctx => {
            const [issues, params] = ctx.params;

            return issues === null && params[key] === ctx.interaction.user.id;
        },
    });
