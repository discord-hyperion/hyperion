import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Statements } from "./table.ts";
import { validate } from "./validate.ts";

/** The one table the package creates itself. Its layout is fixed. */
export const kvTable = `CREATE TABLE IF NOT EXISTS _hyperion_kv (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    expires INTEGER,
    PRIMARY KEY (namespace, key)
)`;

export type KeyValueSetOptions = {
    /** Milliseconds until the key expires. Without it, the key never expires. */
    ttl?: number;
};

/** One namespace of JSON values, keyed by string. */
export type KeyValueStore<Input, Output> = {
    /** The value, or `undefined` when the key is missing or expired. */
    get: (key: string) => Output | undefined;
    /** Store the value and return it as stored. Replaces any earlier expiry. */
    set: (key: string, value: Input, options?: KeyValueSetOptions) => Output;
    /** Whether the key exists and hasn't expired. */
    has: (key: string) => boolean;
    /** Delete the key. Returns whether it existed and hadn't expired. */
    delete: (key: string) => boolean;
    /** Every unexpired `[key, value]` pair, ordered by key. */
    entries: () => [string, Output][];
    /** Delete every key. Returns how many unexpired keys were deleted. */
    clear: () => number;
};

const describe = (path: string) => (path ? ` at ${path}` : "");

/** Throw unless `value` comes back from JSON unchanged. */
const assertJson = (value: unknown, subject: string, path = ""): void => {
    const reject = (what: string, at = path) => {
        throw new TypeError(
            `${subject} holds ${what}${describe(at)}, which JSON can't store unchanged.`,
        );
    };

    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    )
        return;

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            reject(String(value));
        }

        return;
    }

    if (typeof value !== "object") {
        reject(
            typeof value === "undefined" ? "undefined" : `a ${typeof value}`,
        );
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            if (!(index in value)) {
                reject("an empty array slot", `${path}[${index}]`);
            }

            assertJson(value[index], subject, `${path}[${index}]`);
        }

        return;
    }

    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
        reject(`a ${(value as object).constructor?.name ?? "class instance"}`);
    }

    for (const [key, item] of Object.entries(value as object)) {
        assertJson(item, subject, path ? `${path}.${key}` : key);
    }
};

const assertString = (value: unknown, what: string) => {
    if (typeof value !== "string") {
        throw new TypeError(`The ${what} must be a string.`);
    }
};

export const createKeyValueStore = (
    statements: Statements,
    namespace: string,
    schema: StandardSchemaV1 | undefined,
): KeyValueStore<unknown, unknown> => {
    assertString(namespace, "key-value namespace");

    const subject = (key: string) => `The "${namespace}" value for "${key}"`;
    const parse = (key: string, value: unknown) =>
        schema ? validate(schema, value, subject(key)) : value;
    const live = (expires: unknown) =>
        expires === null || Number(expires) > Date.now();
    const sweep = () =>
        statements
            .prepare(
                "DELETE FROM _hyperion_kv WHERE namespace = ? AND expires <= ?",
            )
            .run(namespace, Date.now());
    const read = (key: string) => {
        assertString(key, "key");

        const row = statements
            .prepare(
                "SELECT value, expires FROM _hyperion_kv WHERE namespace = ? AND key = ?",
            )
            .get(namespace, key);

        if (!row) return undefined;

        if (!live(row.expires)) {
            statements
                .prepare(
                    "DELETE FROM _hyperion_kv WHERE namespace = ? AND key = ?",
                )
                .run(namespace, key);

            return undefined;
        }

        return row;
    };

    return {
        get: key => {
            const row = read(key);

            return row === undefined
                ? undefined
                : parse(key, JSON.parse(String(row.value)));
        },

        set: (key, value, { ttl } = {}) => {
            assertString(key, "key");

            const expires =
                ttl === undefined ? null : Math.ceil(Date.now() + ttl);

            if (
                ttl !== undefined &&
                !(
                    typeof ttl === "number" &&
                    ttl > 0 &&
                    Number.isSafeInteger(expires)
                )
            ) {
                throw new RangeError(
                    `The ttl for "${key}" in "${namespace}" must be a positive, finite number of milliseconds.`,
                );
            }

            const stored = parse(key, value);

            assertJson(stored, subject(key));
            statements
                .prepare(
                    "INSERT INTO _hyperion_kv (namespace, key, value, expires) VALUES (?, ?, ?, ?)" +
                        " ON CONFLICT (namespace, key) DO UPDATE SET value = excluded.value, expires = excluded.expires",
                )
                .run(namespace, key, JSON.stringify(stored), expires);

            return stored;
        },

        has: key => read(key) !== undefined,

        delete: key =>
            read(key) !== undefined &&
            statements
                .prepare(
                    "DELETE FROM _hyperion_kv WHERE namespace = ? AND key = ?",
                )
                .run(namespace, key).changes > 0,

        entries: () => {
            sweep();

            return statements
                .prepare(
                    "SELECT key, value FROM _hyperion_kv WHERE namespace = ? ORDER BY key",
                )
                .all(namespace)
                .map(row => {
                    const key = String(row.key);

                    return [key, parse(key, JSON.parse(String(row.value)))];
                });
        },

        clear: () => {
            sweep();

            return statements
                .prepare("DELETE FROM _hyperion_kv WHERE namespace = ?")
                .run(namespace).changes;
        },
    };
};
