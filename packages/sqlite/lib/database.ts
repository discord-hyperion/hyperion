import type { StandardSchemaV1 } from "@standard-schema/spec";
import BetterSqlite3 from "better-sqlite3";
import type { Sql } from "./sql.ts";
import { createTable, type Table, type TableKey } from "./table.ts";
import { validate } from "./validate.ts";

type Row = Record<string, unknown>;

/** Moves the database one version forward. */
export type Migration = string | ((db: Database) => void);

export type DatabaseOptions = {
    /** A file path, or `":memory:"` for a database that lives only in this process. */
    path: string;
    /** Entry n moves the database from version n to n + 1. Forward only. */
    migrations?: readonly Migration[];
};

export type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
};

export type Database = {
    /** Helpers for one table, checked against its real columns. */
    table: <Schema extends StandardSchemaV1<Row, Row>>(
        name: string,
        schema: Schema,
        options: { key: TableKey<StandardSchemaV1.InferOutput<Schema>> },
    ) => Table<
        StandardSchemaV1.InferInput<Schema>,
        StandardSchemaV1.InferOutput<Schema>
    >;
    /** The first row, parsed by `schema` when given. */
    get: {
        <Schema extends StandardSchemaV1>(
            query: Sql,
            schema: Schema,
        ): StandardSchemaV1.InferOutput<Schema> | undefined;
        (query: Sql): unknown;
    };
    /** Every row, parsed by `schema` when given. */
    all: {
        <Schema extends StandardSchemaV1>(
            query: Sql,
            schema: Schema,
        ): StandardSchemaV1.InferOutput<Schema>[];
        (query: Sql): unknown[];
    };
    /** Run a statement that returns no rows. */
    run: (query: Sql) => RunResult;
    /** Run `fn` in a transaction; it commits when `fn` returns and rolls back when it throws. */
    transaction: <Result>(fn: () => Result) => Result;
    close: () => void;
    /** The underlying better-sqlite3 database. */
    raw: BetterSqlite3.Database;
};

const migrate = (db: Database, migrations: readonly Migration[]) => {
    const version = Number(db.raw.pragma("user_version", { simple: true }));

    if (version > migrations.length) {
        throw new Error(
            `The database is at version ${version}, but only ${migrations.length} migration(s) exist. Is this an older build?`,
        );
    }

    for (const [index, migration] of migrations.entries()) {
        if (index < version) continue;

        db.transaction(() => {
            if (typeof migration === "string") {
                db.raw.exec(migration);
            } else {
                migration(db);
            }

            db.raw.pragma(`user_version = ${index + 1}`);
        });
    }
};

/** Open a database, configure it, and run any pending migrations. */
export const createDatabase = ({
    path,
    migrations = [],
}: DatabaseOptions): Database => {
    const raw = new BetterSqlite3(path, { timeout: 5000 });
    const cache = new Map<string, BetterSqlite3.Statement<unknown[], Row>>();
    const prepare = (text: string) => {
        let statement = cache.get(text);

        if (!statement) {
            statement = raw.prepare<unknown[], Row>(text);
            cache.set(text, statement);
        }

        return statement;
    };
    const statements = { raw, prepare };
    const parse = (schema: StandardSchemaV1 | undefined, row: unknown) =>
        schema ? validate(schema, row, "query") : row;

    raw.pragma("journal_mode = WAL");
    raw.pragma("foreign_keys = ON");

    const db: Database = {
        table: (name, schema, { key }) =>
            createTable(statements, name, schema, key),

        get: ((query: Sql, schema?: StandardSchemaV1) => {
            const row = prepare(query.text).get(...query.values);

            return row === undefined ? undefined : parse(schema, row);
        }) as Database["get"],

        all: ((query: Sql, schema?: StandardSchemaV1) =>
            prepare(query.text)
                .all(...query.values)
                .map(row => parse(schema, row))) as Database["all"],

        run: query => {
            const { changes, lastInsertRowid } = prepare(query.text).run(
                ...query.values,
            );

            return { changes, lastInsertRowid };
        },

        transaction: fn => raw.transaction(fn)(),
        close: () => raw.close(),
        raw,
    };

    try {
        migrate(db, migrations);
    } catch (error) {
        raw.close();

        throw error;
    }

    return db;
};
