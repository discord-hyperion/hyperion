import type { StandardSchemaV1 } from "@standard-schema/spec";
import type BetterSqlite3 from "better-sqlite3";
import { bindable, quote } from "./sql.ts";
import { validate } from "./validate.ts";

type Row = Record<string, unknown>;

/** Runs prepared statements from the database's cache. */
export type Statements = {
    readonly raw: BetterSqlite3.Database;
    prepare: (text: string) => BetterSqlite3.Statement<unknown[], Row>;
};

/** The column, or columns, a primary key or unique constraint covers. */
export type TableKey<Output> =
    | (keyof Output & string)
    | readonly [keyof Output & string, ...(keyof Output & string)[]];

/** Equality on each given column, joined with AND. `null` matches `IS NULL`. */
export type Filter<Output> = {
    readonly [Column in keyof Output]?: Output[Column];
};

export type Table<Input, Output> = {
    /** The one matching row, or `undefined`. Throws when several rows match. */
    get: (filter: Filter<Output>) => Output | undefined;
    /** Every matching row; every row without a filter. */
    all: (filter?: Filter<Output>) => Output[];
    /** Insert the row, or update the row with the same key. Returns the stored row. */
    set: (row: Input) => Output;
    /** Merge `patch` into every matching row. Returns the number of rows changed. */
    update: (filter: Filter<Output>, patch: Partial<Input>) => number;
    /** Delete the matching rows. Returns the number of rows deleted. */
    delete: (filter: Filter<Output>) => number;
    /** Delete every row. Returns the number of rows deleted. */
    deleteAll: () => number;
};

const sameColumns = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every(column => b.includes(column));

/** The columns of each primary key and full unique index on `table`. */
const constraints = (statements: Statements, table: string) => {
    const primary = statements
        .prepare(
            "SELECT name FROM pragma_table_info(?) WHERE pk > 0 ORDER BY pk",
        )
        .all(table)
        .map(column => String(column.name));
    const indexes = statements
        .prepare(
            'SELECT name FROM pragma_index_list(?) WHERE "unique" = 1 AND partial = 0',
        )
        .all(table)
        .map(index =>
            statements
                .prepare("SELECT name FROM pragma_index_info(?)")
                .all(index.name)
                .map(column => String(column.name)),
        );

    return [primary, ...indexes];
};

/** Present values only: `undefined` means a value wasn't given. */
const defined = (row: Row) =>
    Object.entries(row).filter(([, value]) => value !== undefined);

export const createTable = <Schema extends StandardSchemaV1<Row, Row>>(
    statements: Statements,
    name: string,
    schema: Schema,
    key: TableKey<StandardSchemaV1.InferOutput<Schema>>,
): Table<
    StandardSchemaV1.InferInput<Schema>,
    StandardSchemaV1.InferOutput<Schema>
> => {
    type Output = StandardSchemaV1.InferOutput<Schema>;

    const columns = statements
        .prepare("SELECT name FROM pragma_table_info(?)")
        .all(name)
        .map(column => String(column.name));
    const keys: readonly string[] = typeof key === "string" ? [key] : key;

    if (columns.length === 0) {
        throw new Error(`Table "${name}" doesn't exist.`);
    }

    for (const column of keys) {
        if (!columns.includes(column)) {
            throw new Error(
                `Key column "${column}" isn't a column of "${name}".`,
            );
        }
    }

    if (
        !constraints(statements, name).some(found => sameColumns(found, keys))
    ) {
        throw new Error(
            `"${name}" has no primary key or unique constraint on (${keys.join(", ")}).`,
        );
    }

    const table = quote(name);
    const known = (column: string) => {
        if (!columns.includes(column)) {
            throw new Error(`Unknown column "${column}" in "${name}".`);
        }

        return quote(column);
    };
    const value = (column: string, value: unknown) =>
        bindable(value, `"${name}"."${column}"`);
    const where = (filter: Row) => {
        const conditions: string[] = [];
        const values: unknown[] = [];

        for (const [column, given] of Object.entries(filter)) {
            if (given === undefined) {
                throw new TypeError(
                    `The filter on "${name}"."${column}" is undefined; use null to match NULL.`,
                );
            }

            if (given === null) {
                conditions.push(`${known(column)} IS NULL`);
            } else {
                conditions.push(`${known(column)} = ?`);
                values.push(value(column, given));
            }
        }

        return {
            text: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
            values,
            empty: conditions.length === 0,
        };
    };
    const nonEmpty = (filter: Row, method: string) => {
        const found = where(filter);

        if (found.empty) {
            throw new Error(
                `${method}() on "${name}" needs a filter; use deleteAll() to delete every row.`,
            );
        }

        return found;
    };
    const parse = (row: unknown): Output => validate(schema, row, name);
    const select = (filter: Row, limit = "") => {
        const found = where(filter);

        return statements
            .prepare(`SELECT * FROM ${table}${found.text}${limit}`)
            .all(...found.values);
    };

    return {
        get: filter => {
            const rows = select(filter, " LIMIT 2");

            if (rows.length > 1) {
                throw new Error(
                    `Several "${name}" rows match; get() expects at most one.`,
                );
            }

            return rows[0] === undefined ? undefined : parse(rows[0]);
        },

        all: (filter = {}) => select(filter).map(parse),

        set: row => {
            const entries = defined(validate(schema, row, name));
            const names = entries.map(([column]) => known(column));
            const text =
                `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})` +
                ` ON CONFLICT (${keys.map(quote).join(", ")}) DO UPDATE SET ${names.map(column => `${column} = excluded.${column}`).join(", ")}` +
                " RETURNING *";

            return parse(
                statements
                    .prepare(text)
                    .get(
                        ...entries.map(([column, given]) =>
                            value(column, given),
                        ),
                    ),
            );
        },

        update: (filter, patch) => {
            const found = nonEmpty(filter, "update");
            const changed = defined(patch).map(([column]) => column);

            if (changed.length === 0) return 0;

            const assignments = changed.map(column => `${known(column)} = ?`);
            const text = `UPDATE ${table} SET ${assignments.join(", ")} WHERE ${keys.map(column => `${quote(column)} IS ?`).join(" AND ")}`;

            return statements.raw.transaction(() => {
                let total = 0;

                for (const stored of statements
                    .prepare(`SELECT * FROM ${table}${found.text}`)
                    .all(...found.values)) {
                    const merged: Row = validate(
                        schema,
                        { ...stored, ...Object.fromEntries(defined(patch)) },
                        name,
                    );

                    total += statements
                        .prepare(text)
                        .run(
                            ...changed.map(column =>
                                value(column, merged[column]),
                            ),
                            ...keys.map(column => stored[column]),
                        ).changes;
                }

                return total;
            })();
        },

        delete: filter => {
            const found = nonEmpty(filter, "delete");

            return statements
                .prepare(`DELETE FROM ${table}${found.text}`)
                .run(...found.values).changes;
        },

        deleteAll: () =>
            statements.prepare(`DELETE FROM ${table}`).run().changes,
    };
};
