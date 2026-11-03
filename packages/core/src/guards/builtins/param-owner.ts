import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { InteractionContext } from "../../contexts/index.ts";
import { Guard } from "../guard.ts";

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
export class ParamOwner<Key extends string> extends Guard<
    ParamOwnerContext<Key>
> {
    constructor(
        private readonly key: Key,
        description = "Only the person this was sent for can use it.",
    ) {
        super({ name: "param-owner", description });
    }

    run(ctx: ParamOwnerContext<Key>) {
        const [issues, params] = ctx.params;

        return issues === null && params[this.key] === ctx.interaction.user.id;
    }
}
