/** A value SQLite can bind. */
export type SqlValue = string | number | bigint | Uint8Array | null;

/** A query built by the `sql` tag: its text, with every value as a parameter. */
export class Sql {
    // Makes the type nominal, so a plain { text, values } object isn't a query.
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: read only by the type checker.
    readonly #tagged = true;
    readonly text: string;
    readonly values: readonly SqlValue[];

    constructor(text: string, values: readonly SqlValue[]) {
        this.text = text;
        this.values = values;
    }
}

/**
 * Build a query. Every interpolated value becomes a bound parameter, so values
 * can't inject SQL; table and column names can't be interpolated.
 */
export const sql = (
    strings: TemplateStringsArray,
    ...values: readonly SqlValue[]
) => {
    for (const [index, value] of values.entries()) {
        if (value instanceof Sql) {
            throw new TypeError(
                `sql parameter ${index + 1} is a query; queries can't be nested.`,
            );
        }

        bindable(value, `parameter ${index + 1}`);
    }

    return new Sql(strings.join("?"), values);
};

/** Reject anything the `sql` tag didn't build, such as a plain object. */
export const tagged = (query: unknown): Sql => {
    if (!(query instanceof Sql)) {
        throw new TypeError("Build queries with the sql tag.");
    }

    return query;
};

/** Reject numbers that SQLite would store, or JavaScript would read, imprecisely. */
export const bindable = (value: unknown, name: string) => {
    if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        !Number.isSafeInteger(value)
    ) {
        throw new RangeError(
            `${name} is ${value}, which isn't a safe integer. Store large IDs, such as Discord IDs, as TEXT, or bind a bigint.`,
        );
    }

    return value;
};

/** Quote a checked identifier. */
export const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
