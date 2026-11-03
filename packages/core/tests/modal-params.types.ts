import { ModalBuilder } from "@discordjs/builders";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as v from "valibot";
import {
    defineInput,
    defineParams,
    type ModalContext,
    ModalHandler,
    ParamOwner,
} from "../src/index.ts";
import type { ModalRegistry } from "../src/registries/index.ts";

const rename = defineParams({
    id: "ticket.rename",
    keys: ["ticketId", "owner"],
    schema: v.object({ ticketId: v.string(), owner: v.string() }),
});

const input = defineInput({
    schema: v.object({ title: v.string() }),
    resolve: async ({ title }, ctx: ModalContext<undefined, typeof rename>) => {
        const [issues, params] = ctx.params;
        return { title, ticketId: issues ? undefined : params.ticketId };
    },
});

type RenameContext = ModalContext<typeof input, typeof rename>;

export class RenameTicket extends ModalHandler<typeof input, typeof rename> {
    constructor() {
        super({
            params: rename,
            builder: new ModalBuilder().setTitle("Rename"),
            input,
            guards: [
                new ParamOwner("owner"),
                ctx => {
                    ctx.params satisfies RenameContext["params"];
                    // @ts-expect-error Guards run before input processing.
                    ctx.input;
                    return new ParamOwner("owner");
                },
            ],
        });
    }

    async run(ctx: RenameContext) {
        const [paramIssues, params] = ctx.params;
        if (paramIssues) {
            params satisfies undefined;
            return;
        }

        params.ticketId satisfies string;
        const [inputIssues, value] = ctx.input;
        if (inputIssues) return;

        value.title satisfies string;
        value.ticketId satisfies string | undefined;
    }
}

export const modalParamsContracts = (registry: ModalRegistry) => {
    registry.build(rename, {
        ticketId: "a1b2c3d4",
        owner: "1",
    }) satisfies ModalBuilder;
    registry.build("feedback.submit") satisfies ModalBuilder;
    // @ts-expect-error Values are typed from the definition's keys.
    registry.build(rename, { ticketId: "a1b2c3d4" });

    // @ts-expect-error A resolver that reads params needs a params handler.
    class Literal extends ModalHandler<typeof input> {
        constructor() {
            // @ts-expect-error The same mismatch rejects the input option.
            super({ customId: "literal", input });
        }

        async run() {}
    }

    class Both extends ModalHandler<undefined, typeof rename> {
        constructor() {
            // @ts-expect-error Params handlers cannot also declare a literal custom ID.
            super({ params: rename, customId: "ticket.rename" });
        }

        async run() {}
    }

    class Typo extends ModalHandler<undefined, typeof rename> {
        constructor() {
            // @ts-expect-error The key must exist in the params.
            super({ params: rename, guards: [new ParamOwner("ownr")] });
        }

        async run() {}
    }

    return [Literal, Both, Typo];
};

export const keysContracts = () => {
    const schema = v.object({
        ticketId: v.string(),
        owner: v.string(),
        page: v.pipe(v.string(), v.toNumber()),
    });

    defineParams({ id: "ok", keys: ["ticketId", "owner", "page"], schema });
    defineParams({
        id: "reordered",
        keys: ["page", "owner", "ticketId"],
        schema,
    });
    // @ts-expect-error Missing from keys: page.
    defineParams({ id: "missing", keys: ["ticketId", "owner"], schema });
    // @ts-expect-error Not in the schema: ownr.
    defineParams({ id: "typo", keys: ["ticketId", "ownr", "page"], schema });
    defineParams({
        id: "record",
        keys: ["anything"],
        schema: v.record(v.string(), v.string()),
    });
    defineParams({
        id: "untyped",
        keys: ["anything"],
        schema: {} as StandardSchemaV1,
    });
};
