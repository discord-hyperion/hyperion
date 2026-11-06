import { PrimaryButtonBuilder } from "@discordjs/builders";
import * as v from "valibot";
import {
    type ButtonContext,
    ButtonHandler,
    defineParams,
    type ParamsDefinition,
} from "../src/index.ts";

const params = defineParams({
    id: "todo.done",
    keys: ["owner", "page"],
    schema: v.object({
        owner: v.string(),
        page: v.pipe(v.string(), v.toNumber()),
    }),
});

export const encoderContracts = () => {
    params({ owner: "1", page: 2 }) satisfies string;
    params({ owner: "1", page: true });
    // @ts-expect-error Every declared key is required.
    params({ owner: "1" });
    // @ts-expect-error Undeclared keys are rejected.
    params({ owner: "1", page: 2, extra: 1 });
    // @ts-expect-error Objects cannot be encoded.
    params({ owner: {}, page: 2 });
    params satisfies ParamsDefinition;
};

class WithParams extends ButtonHandler<{ params: typeof params }> {
    constructor() {
        super({ params });
    }

    async run(ctx: ButtonContext<{ params: typeof params }>) {
        const [issues, value] = ctx.params;

        if (issues) {
            value satisfies undefined;

            return;
        }

        value.owner satisfies string;
        value.page satisfies number;
        // @ts-expect-error Params come from schema output.
        value.missing;
    }
}

export const handlerContracts = (plain: ButtonContext) => {
    new WithParams() satisfies ButtonHandler<{ params: typeof params }>;
    // @ts-expect-error Literal handler contexts carry no params.
    plain.params;
    // @ts-expect-error A template is optional, so it may be undefined.
    new WithParams().builder.toJSON();
};

export class Literal extends ButtonHandler {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder().setCustomId("x").setLabel("x"),
        });
    }

    async run() {}
}

export const exclusiveOptions = () => {
    class Both extends ButtonHandler<{ params: typeof params }> {
        constructor() {
            super({
                params,
                // @ts-expect-error Params handlers cannot also declare a literal custom ID.
                customId: "x",
            });
        }

        async run() {}
    }

    return Both;
};
