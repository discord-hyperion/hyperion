import assert from "node:assert/strict";
import { createDatabase, RowValidationError, sql } from "@hyperion/sqlite";
import * as v from "valibot";

const db = createDatabase({
    path: ":memory:",
    migrations: [
        "CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL)",
    ],
});
const todos = db.table(
    "todos",
    v.object({ id: v.string(), title: v.pipe(v.string(), v.minLength(1)) }),
    { key: "id" },
);

assert.deepEqual(todos.set({ id: "1", title: "Pack" }), {
    id: "1",
    title: "Pack",
});
assert.throws(() => todos.set({ id: "2", title: "" }), RowValidationError);
assert.deepEqual(db.all(sql`SELECT id FROM todos WHERE title = ${"Pack"}`), [
    { id: "1" },
]);
assert.equal(db.raw.pragma("user_version", { simple: true }), 1);
const flags = db.kv("flags");
flags.set("maintenance", true, { ttl: 60_000 });
assert.equal(flags.get("maintenance"), true);
assert.throws(() => flags.set("when", new Date()), TypeError);
db.close();
assert.throws(() => import.meta.resolve("@hyperion/core"), {
    code: "ERR_MODULE_NOT_FOUND",
});
console.log(
    "PASS SQLite tables, key-value namespaces, queries, the native driver, and no core dependency",
);
