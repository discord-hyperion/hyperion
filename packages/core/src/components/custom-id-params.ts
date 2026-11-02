import type { StandardSchemaV1 } from "@standard-schema/spec";

const separator = ":";
const maxCustomIdLength = 100;

/** Declares the route, wire order, and schema of a custom ID's values. */
export type ParamsDefinition<
    Keys extends readonly string[] = readonly string[],
    Schema extends StandardSchemaV1 = StandardSchemaV1,
> = {
    readonly id: string;
    readonly keys: Keys;
    readonly schema: Schema;
};

export type ParamValues<Keys extends readonly string[]> = {
    readonly [Key in Keys[number]]: string | number | boolean;
};

/** A definition that also encodes values into a custom ID when called. */
export type CustomIdParams<
    Keys extends readonly string[] = readonly string[],
    Schema extends StandardSchemaV1 = StandardSchemaV1,
> = ((values: ParamValues<Keys>) => string) & ParamsDefinition<Keys, Schema>;

/** A schema failure exposes no partial output. */
export type ParamsResult<Params extends ParamsDefinition> =
    | readonly [
          issues: null,
          params: StandardSchemaV1.InferOutput<Params["schema"]>,
      ]
    | readonly [issues: readonly StandardSchemaV1.Issue[], params: undefined];

const escapeValue = (value: string) =>
    value.replaceAll("%", "%25").replaceAll(separator, "%3A");

const unescapeValue = (value: string) =>
    /%(?!25|3A)/.test(value)
        ? undefined
        : value.replaceAll("%3A", separator).replaceAll("%25", "%");

/** Validate and snapshot a definition without evaluating application code. */
export const validateParams = (params: ParamsDefinition | undefined) => {
    if (params === undefined) return undefined;
    if (
        !params ||
        (typeof params !== "object" && typeof params !== "function")
    ) {
        throw new TypeError("Params require a definition from defineParams().");
    }

    if (typeof params.id !== "string" || params.id === "") {
        throw new TypeError("Params id must be a non-empty string.");
    }
    if (params.id.includes(separator) || params.id.includes("%")) {
        throw new TypeError(
            `Params id must not contain "${separator}" or "%".`,
        );
    }
    if (
        !Array.isArray(params.keys) ||
        params.keys.some(key => typeof key !== "string" || key === "") ||
        new Set(params.keys).size !== params.keys.length
    ) {
        throw new TypeError("Params keys must be unique non-empty strings.");
    }

    const standard = params.schema?.["~standard"];
    if (standard?.version !== 1 || typeof standard.validate !== "function") {
        throw new TypeError("Params schema must implement Standard Schema v1.");
    }

    return Object.freeze({
        id: params.id,
        keys: Object.freeze([...params.keys]),
        schema: params.schema,
    });
};

/**
 * Define the values a handler reads from its custom ID. Calling the result
 * builds a custom ID; passing it to a handler declares how to read one.
 */
export const defineParams = <
    const Keys extends readonly string[],
    Schema extends StandardSchemaV1,
>(definition: {
    readonly id: string;
    readonly keys: Keys;
    readonly schema: Schema;
}): CustomIdParams<Keys, Schema> => {
    const snapshot = validateParams(definition);
    if (!snapshot) throw new TypeError("defineParams requires a definition.");

    const encode = (values: ParamValues<Keys>) => {
        const segments = [snapshot.id];

        for (const key of snapshot.keys) {
            const value: unknown = (values as Record<string, unknown>)[key];

            if (
                typeof value !== "string" &&
                typeof value !== "boolean" &&
                !(typeof value === "number" && Number.isFinite(value))
            ) {
                throw new TypeError(
                    `Param "${key}" must be a string, finite number, or boolean.`,
                );
            }

            segments.push(escapeValue(String(value)));
        }

        const customId = segments.join(separator);
        if (customId.length > maxCustomIdLength) {
            throw new RangeError(
                `Custom ID for "${snapshot.id}" exceeds ${maxCustomIdLength} characters.`,
            );
        }

        return customId;
    };

    return Object.freeze(
        Object.assign(encode, {
            id: snapshot.id,
            keys: snapshot.keys as unknown as Keys,
            schema: snapshot.schema as Schema,
        }),
    );
};

/** Split a custom ID into raw values, or undefined when it is not this route. */
export const decodeParams = (params: ParamsDefinition, customId: string) => {
    const segments = customId.split(separator);
    if (
        segments[0] !== params.id ||
        segments.length !== params.keys.length + 1
    ) {
        return undefined;
    }

    const raw: Record<string, string> = {};

    for (const [index, key] of params.keys.entries()) {
        const value = unescapeValue(segments[index + 1] ?? "");
        if (value === undefined) return undefined;

        raw[key] = value;
    }

    return raw;
};
