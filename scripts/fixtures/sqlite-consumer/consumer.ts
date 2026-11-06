import { createDatabase, sql, type Table } from "@hyperion/sqlite";
import * as v from "valibot";

const schema = v.object({
    id: v.string(),
    count: v.number(),
    note: v.nullable(v.string()),
});
const db = createDatabase({
    path: ":memory:",
    migrations: [
        "CREATE TABLE counters (id TEXT PRIMARY KEY, count INTEGER NOT NULL, note TEXT)",
    ],
});
const counters: Table<
    { id: string; count: number; note: string | null },
    { id: string; count: number; note: string | null }
> = db.table("counters", schema, { key: "id" });
const stored: { count: number } = counters.set({
    id: "a",
    count: 1,
    note: null,
});
const found: { count: number } | undefined = counters.get({
    id: "a",
    note: null,
});
const changed: number = counters.update({ id: "a" }, { count: 2 });
const queried = db.get(
    sql`SELECT count FROM counters`,
    v.object({ count: v.number() }),
);
const loose: unknown[] = db.all(sql`SELECT * FROM counters`);
const result: { changes: number; lastInsertRowid: number | bigint } = db.run(
    sql`DELETE FROM counters WHERE id = ${"a"}`,
);

void [
    stored,
    found,
    changed,
    queried?.count satisfies number | undefined,
    loose,
    result,
];

// Type-only checks: never called.
const rejected = () => {
    // @ts-expect-error the key names a schema column
    db.table("counters", schema, { key: "missing" });
    // @ts-expect-error filters name schema columns
    counters.all({ missing: 1 });
    // @ts-expect-error rows match the schema
    counters.set({ id: "a", count: "1", note: null });
    // @ts-expect-error patches match the schema
    counters.update({ id: "a" }, { count: "2" });
    // @ts-expect-error only SQL values can be interpolated
    sql`SELECT ${{ id: "a" }}`;
    // @ts-expect-error queries must come from the sql tag
    db.get("SELECT 1");
};

void rejected;
db.close();
console.log("PASS SQLite published types");
