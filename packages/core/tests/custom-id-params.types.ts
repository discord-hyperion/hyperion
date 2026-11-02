import { PrimaryButtonBuilder } from "@discordjs/builders";
import * as v from "valibot";
import {
    Button,
    type ButtonContext,
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

class WithParams extends Button<typeof params> {
    constructor() {
        super({ params });
    }

    async run(ctx: ButtonContext<typeof params>) {
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
    new WithParams() satisfies Button<typeof params>;
    // @ts-expect-error Literal handler contexts carry no params.
    plain.params;
    // @ts-expect-error A params handler has no template builder.
    new WithParams().builder.toJSON();
};

export class Literal extends Button {
    constructor() {
        super({
            builder: new PrimaryButtonBuilder().setCustomId("x").setLabel("x"),
        });
    }

    async run() {}
}

export const exclusiveOptions = () => {
    class Both extends Button<typeof params> {
        constructor() {
            super({
                params,
                // @ts-expect-error Params handlers cannot supply a builder.
                builder: new PrimaryButtonBuilder().setCustomId("x"),
            });
        }

        async run() {}
    }

    return Both;
};
