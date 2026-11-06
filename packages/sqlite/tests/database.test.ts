import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import * as v from "valibot";
import {
    createDatabase,
    type Migration,
    RowValidationError,
    sql,
} from "../lib/index.ts";

const todos = `CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT
)`;
const todoSchema = v.object({
    id: v.string(),
    owner: v.string(),
    title: v.pipe(v.string(), v.minLength(1, "Title must not be empty.")),
    note: v.nullable(v.string()),
});
const open = (migrations: Migration[] = [todos]) =>
    createDatabase({ path: ":memory:", migrations });
const count = (db: ReturnType<typeof open>) =>
    db.get(sql`SELECT count(*) AS n FROM todos`, v.object({ n: v.number() }))
        ?.n;

test("createDatabase enables foreign keys and runs migrations in order", () => {
    const db = open([
        "CREATE TABLE guilds (id TEXT PRIMARY KEY)",
        db => {
            db.run(sql`INSERT INTO guilds (id) VALUES (${"g1"})`);
        },
    ]);

    assert.equal(db.raw.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(db.raw.pragma("user_version", { simple: true }), 2);
    assert.deepEqual(db.all(sql`SELECT id FROM guilds`), [{ id: "g1" }]);
    db.close();
});

test("a file database uses WAL and runs only the migrations it hasn't", t => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "hyperion-sqlite-"));
    const file = path.join(directory, "bot.db");
    let runs = 0;
    const migrations = [
        todos,
        () => {
            runs += 1;
        },
    ];

    t.after(() => rmSync(directory, { recursive: true, force: true }));
    createDatabase({ path: file, migrations }).close();
    const db = createDatabase({ path: file, migrations });

    assert.equal(runs, 1);
    assert.equal(db.raw.pragma("journal_mode", { simple: true }), "wal");
    db.close();

    assert.throws(
        () => createDatabase({ path: file, migrations: [todos] }),
        /version 2, but only 1 migration/,
    );
});

test("a failing migration rolls back and leaves the version unchanged", t => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "hyperion-sqlite-"));
    const file = path.join(directory, "bot.db");

    t.after(() => rmSync(directory, { recursive: true, force: true }));

    assert.throws(
        () =>
            createDatabase({
                path: file,
                migrations: [todos, "CREATE TABLE a (id TEXT); SELECT nope"],
            }),
        /no such column/,
    );
    const db = createDatabase({ path: file, migrations: [todos] });

    assert.equal(db.raw.pragma("user_version", { simple: true }), 1);
    assert.equal(
        db.get(sql`SELECT name FROM sqlite_master WHERE name = ${"a"}`),
        undefined,
    );
    db.close();
});

test("sql binds every value as a parameter", () => {
    const db = open();
    const hostile = "x'); DROP TABLE todos; --";

    db.run(
        sql`INSERT INTO todos (id, owner, title) VALUES (${"1"}, ${"alex"}, ${hostile})`,
    );

    assert.deepEqual(db.all(sql`SELECT title FROM todos`), [
        { title: hostile },
    ]);
    db.close();
});

test("sql rejects unsafe integers and nested queries", () => {
    assert.throws(() => sql`SELECT ${2 ** 53}`, {
        name: "RangeError",
        message: /parameter 1 is 9007199254740992.*TEXT/,
    });
    // @ts-expect-error queries aren't values
    assert.throws(() => sql`SELECT ${sql`1`}`, /can't be nested/);
    assert.doesNotThrow(() => sql`SELECT ${1.5}, ${2n ** 60n}`);
});

test("run returns changes and the last row ID; get and all parse with a schema", () => {
    const db = open(["CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)"]);
    const result = db.run(sql`INSERT INTO notes (body) VALUES (${"hi"})`);
    const note = v.object({ id: v.number(), body: v.string() });

    assert.deepEqual(result, { changes: 1, lastInsertRowid: 1 });
    assert.deepEqual(db.get(sql`SELECT * FROM notes`, note), {
        id: 1,
        body: "hi",
    });
    assert.equal(
        db.get(sql`SELECT * FROM notes WHERE id = ${2}`, note),
        undefined,
    );
    assert.throws(
        () => db.all(sql`SELECT * FROM notes`, v.object({ body: v.number() })),
        RowValidationError,
    );
    db.close();
});

test("transaction commits on return and rolls back on throw", () => {
    const db = open();
    const insert = (id: string) =>
        db.run(
            sql`INSERT INTO todos (id, owner, title) VALUES (${id}, ${"alex"}, ${"t"})`,
        );

    assert.equal(
        db.transaction(() => {
            insert("1");

            return "done";
        }),
        "done",
    );
    assert.throws(() =>
        db.transaction(() => {
            insert("2");

            throw new Error("stop");
        }),
    );
    assert.throws(() => db.transaction(async () => insert("3")), /promise/);
    assert.equal(count(db), 1);
    db.close();
});

test("table() checks the table, the key column, and its constraint", () => {
    const db = open([
        todos,
        "CREATE TABLE members (guildId TEXT, userId TEXT, xp INTEGER, UNIQUE (guildId, userId))",
        "CREATE TABLE loose (name TEXT)",
    ]);
    const member = v.object({
        guildId: v.string(),
        userId: v.string(),
        xp: v.number(),
    });

    assert.throws(
        () => db.table("missing", todoSchema, { key: "id" }),
        /"missing" doesn't exist/,
    );
    assert.throws(
        // @ts-expect-error not a schema column
        () => db.table("todos", todoSchema, { key: "nope" }),
        /"nope" isn't a column/,
    );
    assert.throws(
        () => db.table("todos", todoSchema, { key: "owner" }),
        /no primary key or unique constraint on \(owner\)/,
    );
    assert.throws(
        () =>
            db.table("loose", v.object({ name: v.string() }), { key: "name" }),
        /no primary key or unique constraint/,
    );
    assert.doesNotThrow(() =>
        db.table("members", member, { key: ["guildId", "userId"] }),
    );
    assert.throws(
        () => db.table("members", member, { key: "guildId" }),
        /no primary key or unique constraint/,
    );
    db.close();
});

test("set upserts on the key and returns the stored row", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    assert.deepEqual(
        table.set({ id: "1", owner: "alex", title: "Write", note: null }),
        {
            id: "1",
            owner: "alex",
            title: "Write",
            note: null,
        },
    );
    table.set({ id: "1", owner: "alex", title: "Rewrite", note: "soon" });

    assert.deepEqual(table.all(), [
        { id: "1", owner: "alex", title: "Rewrite", note: "soon" },
    ]);
    db.close();
});

test("set upserts on a composite unique key", () => {
    const db = open([
        "CREATE TABLE members (guildId TEXT, userId TEXT, xp INTEGER NOT NULL, UNIQUE (guildId, userId))",
    ]);
    const members = db.table(
        "members",
        v.object({ guildId: v.string(), userId: v.string(), xp: v.number() }),
        { key: ["guildId", "userId"] },
    );

    members.set({ guildId: "g", userId: "u", xp: 1 });
    members.set({ guildId: "g", userId: "u", xp: 5 });
    members.set({ guildId: "g", userId: "v", xp: 2 });

    assert.deepEqual(members.get({ guildId: "g", userId: "u" }), {
        guildId: "g",
        userId: "u",
        xp: 5,
    });
    assert.equal(members.all({ guildId: "g" }).length, 2);
    db.close();
});

test("filters use equality joined with AND, and null matches IS NULL", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    table.set({ id: "1", owner: "alex", title: "a", note: null });
    table.set({ id: "2", owner: "alex", title: "b", note: "x" });
    table.set({ id: "3", owner: "sam", title: "c", note: null });

    assert.deepEqual(
        table.all({ owner: "alex", note: null }).map(row => row.id),
        ["1"],
    );
    assert.equal(table.get({ id: "4" }), undefined);
    assert.throws(
        () => table.get({ owner: "alex" }),
        /Several "todos" rows match/,
    );
    assert.throws(
        // @ts-expect-error not a column
        () => table.all({ nope: 1 }),
        /Unknown column "nope" in "todos"/,
    );
    assert.throws(
        // @ts-expect-error exactOptionalPropertyTypes rejects undefined
        () => table.all({ owner: undefined }),
        /use null to match NULL/,
    );
    db.close();
});

test("a failed write validation throws the schema's issues and writes nothing", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    assert.throws(
        () => table.set({ id: "1", owner: "alex", title: "", note: null }),
        (error: unknown) =>
            error instanceof RowValidationError &&
            error.issues[0]?.message === "Title must not be empty.",
    );
    assert.equal(count(db), 0);
    db.close();
});

test("update merges, validates every row, and writes all or nothing", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    table.set({ id: "1", owner: "alex", title: "a", note: null });
    table.set({ id: "2", owner: "alex", title: "b", note: null });
    table.set({ id: "3", owner: "sam", title: "c", note: null });

    assert.equal(table.update({ owner: "alex" }, { note: "done" }), 2);
    assert.deepEqual(table.get({ id: "1" }), {
        id: "1",
        owner: "alex",
        title: "a",
        note: "done",
    });
    assert.equal(table.get({ id: "3" })?.note, null);

    assert.throws(
        () => table.update({ owner: "alex" }, { title: "" }),
        RowValidationError,
    );
    assert.deepEqual(
        table.all({ owner: "alex" }).map(row => row.title),
        ["a", "b"],
    );
    assert.equal(table.update({ owner: "nobody" }, { note: "x" }), 0);
    assert.equal(table.update({ id: "1" }, {}), 0);
    db.close();
});

test("update and delete refuse an empty filter; deleteAll is explicit", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    table.set({ id: "1", owner: "alex", title: "a", note: null });
    table.set({ id: "2", owner: "sam", title: "b", note: null });

    assert.throws(
        () => table.update({}, { note: "x" }),
        /update\(\) on "todos" needs a filter/,
    );
    assert.throws(
        () => table.delete({}),
        /delete\(\) on "todos" needs a filter/,
    );
    assert.equal(table.delete({ owner: "alex" }), 1);
    assert.equal(table.deleteAll(), 1);
    assert.equal(count(db), 0);
    db.close();
});

test("reads parse every row", () => {
    const db = open();
    const table = db.table("todos", todoSchema, { key: "id" });

    db.run(
        sql`INSERT INTO todos (id, owner, title) VALUES (${"1"}, ${"alex"}, ${""})`,
    );

    assert.throws(() => table.all(), RowValidationError);
    db.close();
});

test("binding an unsafe integer names the column", () => {
    const db = open(["CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"]);
    const users = db.table(
        "users",
        v.object({ id: v.number(), name: v.string() }),
        {
            key: "id",
        },
    );

    assert.throws(() => users.set({ id: 2 ** 60, name: "x" }), {
        name: "RangeError",
        message: /"users"\."id" is .* isn't a safe integer/,
    });
    db.close();
});

test("async schemas are rejected", () => {
    const db = open();
    const table = db.table(
        "todos",
        v.objectAsync({
            id: v.string(),
            owner: v.string(),
            title: v.string(),
            note: v.nullable(v.string()),
        }),
        { key: "id" },
    );

    assert.throws(
        () => table.set({ id: "1", owner: "a", title: "t", note: null }),
        /validates asynchronously/,
    );
    db.close();
});
