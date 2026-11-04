import type { ParamsDefinition } from "./custom-id-params.ts";

const maxCustomIdLength = 100;

/** A native builder a handler offers its callers as a default control or form. */
export type Template = {
    toJSON: (validate?: boolean) => { custom_id?: string; type?: number };
    setCustomId: (customId: string) => unknown;
};

/** The exact custom ID, or the route for a params handler. */
export const handlerCustomId = (
    kind: string,
    customId: unknown,
    params: ParamsDefinition | undefined,
) => {
    if (customId !== undefined && params !== undefined) {
        throw new TypeError(
            `${kind} handlers accept either a customId or params, not both.`,
        );
    }

    const id = params?.id ?? customId;

    if (typeof id !== "string" || id === "") {
        throw new TypeError(`${kind} handlers require a customId or params.`);
    }

    if (id.length > maxCustomIdLength) {
        throw new RangeError(
            `${kind} custom IDs must not exceed ${maxCustomIdLength} characters.`,
        );
    }

    return id;
};

/** A fresh copy of a template with the custom ID set; the template never changes. */
export const copyTemplate = <Builder extends Template>(
    template: Builder,
    customId: string,
) => {
    const TemplateBuilder = template.constructor as new (
        data: unknown,
    ) => Builder;
    const copy = new TemplateBuilder(template.toJSON(false));

    copy.setCustomId(customId);

    return copy;
};
