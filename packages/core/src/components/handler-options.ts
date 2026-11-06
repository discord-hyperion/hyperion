import type { ParamsDefinition } from "./custom-id-params.ts";

const maxCustomIdLength = 100;

/** A native builder a handler offers its callers as a default control or form. */
export type Template = {
    toJSON: (validate?: boolean) => { custom_id?: string; type?: number };
    setCustomId: (customId: string) => unknown;
};

const templateCustomId = (template: Template | undefined) => {
    const id = template?.toJSON(false).custom_id;

    return id === "" ? undefined : id;
};

/**
 * The exact custom ID, the route for a params handler, or the template's custom
 * ID when the handler gives neither.
 */
export const handlerCustomId = (
    kind: string,
    customId: unknown,
    params: ParamsDefinition | undefined,
    template: Template | undefined,
) => {
    if (customId !== undefined && params !== undefined) {
        throw new TypeError(
            `${kind} handlers accept either a customId or params, not both.`,
        );
    }

    if (customId !== undefined && template !== undefined) {
        throw new TypeError(
            `${kind} handlers with a template take its custom ID; remove customId.`,
        );
    }

    if (params !== undefined && template !== undefined) {
        const route = templateCustomId(template);

        if (route !== params.id) {
            throw new TypeError(
                route === undefined
                    ? `${kind} templates need the params route "${params.id}" as their custom ID.`
                    : `${kind} template custom ID "${route}" doesn't match the params route "${params.id}".`,
            );
        }
    }

    const id = params?.id ?? customId ?? templateCustomId(template);

    if (typeof id !== "string" || id === "") {
        throw new TypeError(
            `${kind} handlers require a customId, params, or a template with a custom ID.`,
        );
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
