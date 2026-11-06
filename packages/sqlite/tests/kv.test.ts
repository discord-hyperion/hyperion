import assert from "node:assert/strict";
import { test } from "node:test";
import * as v from "valibot";
import { createDatabase, RowValidationError, sql } from "../lib/index.ts";

const open = () =>
    createDatabase({ path: ":memory:", migrations: ["SELECT 1"] });

test("kv creates its table on first use and leaves user_version alone", () => {
    const db = open();
    const tables = () =>
        db.all(sql`SELECT name FROM sqlite_master WHERE type = ${"table"}`);

    assert.deepEqual(tables(), []);
    db.kv("settings");
    db.kv("flags");

    assert.deepEqual(tables(), [{ name: "_hyperion_kv" }]);
    assert.equal(db.raw.pragma("user_version", { simple: true }), 1);
    db.close();
});

test("set stores a value and returns it; get, has, and delete read it back", () => {
    const db = open();
    const settings = db.kv(
        "settings",
        v.object({
            prefix: v.pipe(v.string(), v.trim()),
            channel: v.nullable(v.string()),
        }),
    );

    assert.deepEqual(settings.set("g1", { prefix: " ! ", channel: null }), {
        prefix: "!",
        channel: null,
    });
    assert.deepEqual(settings.get("g1"), { prefix: "!", channel: null });
    assert.equal(settings.has("g1"), true);
    assert.equal(settings.get("g2"), undefined);
    assert.equal(settings.delete("g1"), true);
    assert.equal(settings.delete("g1"), false);
    assert.equal(settings.has("g1"), false);
    db.close();
});

test("namespaces are separate, and entries are ordered by key", () => {
    const db = open();
    const a = db.kv("a");
    const b = db.kv("b");

    a.set("2", [1, { deep: true }]);
    a.set("1", "one");
    b.set("1", 1);

    assert.deepEqual(a.entries(), [
        ["1", "one"],
        ["2", [1, { deep: true }]],
    ]);
    assert.deepEqual(b.entries(), [["1", 1]]);
    assert.equal(a.clear(), 2);
    assert.deepEqual(a.entries(), []);
    assert.equal(b.get("1"), 1);
    db.close();
});

test("schemas validate on set and on get, naming the namespace and key", () => {
    const db = open();
    const counts = db.kv("counts", v.number("Counts are numbers."));

    assert.throws(
        // @ts-expect-error the schema types the value
        () => counts.set("u1", "five"),
        (error: unknown) =>
            error instanceof RowValidationError &&
            error.message ===
                'The "counts" value for "u1" failed validation: Counts are numbers.',
    );
    assert.equal(counts.has("u1"), false);

    db.kv("counts").set("u2", "not a number");
    assert.throws(() => counts.get("u2"), RowValidationError);
    assert.throws(() => counts.entries(), RowValidationError);
    db.close();
});

test("values must come back from JSON unchanged", () => {
    const db = open();
    const store = db.kv("store");

    for (const [value, message] of [
        [new Date(0), /holds a Date, which JSON/],
        [new Map(), /holds a Map/],
        [new Set([1]), /holds a Set/],
        [undefined, /holds undefined/],
        [{ a: { b: undefined } }, /holds undefined at a\.b/],
        [[1, Number.NaN], /holds NaN at \[1\]/],
        [Number.POSITIVE_INFINITY, /holds Infinity/],
        [10n, /holds a bigint/],
        [() => 1, /holds a function/],
        // biome-ignore lint/suspicious/noSparseArray: a sparse array is the case under test
        [[1, , 3], /holds an empty array slot at \[1\]/],
    ] as const) {
        assert.throws(() => store.set("k", value), {
            name: "TypeError",
            message,
        });
    }

    assert.equal(store.has("k"), false);
    assert.deepEqual(
        store.set("k", { list: [null, true, 1.5, "x"], empty: {} }),
        {
            list: [null, true, 1.5, "x"],
            empty: {},
        },
    );
    db.close();
});

test("keys and namespaces must be strings", () => {
    const db = open();

    // @ts-expect-error namespaces are strings
    assert.throws(() => db.kv(1), /namespace must be a string/);
    // @ts-expect-error keys are strings
    assert.throws(() => db.kv("a").set(1, "x"), /key must be a string/);
    // @ts-expect-error keys are strings
    assert.throws(() => db.kv("a").get(1), /key must be a string/);
    assert.equal(db.kv("a").set("", "empty key"), "empty key");
    db.close();
});

test("expired keys read as missing and are deleted when read", t => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
    const db = open();
    const cooldowns = db.kv("cooldowns");
    const stored = () =>
        db.get(
            sql`SELECT count(*) AS n FROM _hyperion_kv`,
            v.object({ n: v.number() }),
        )?.n;

    cooldowns.set("a", 1, { ttl: 500 });
    cooldowns.set("b", 2, { ttl: 2_000 });
    cooldowns.set("c", 3);
    t.mock.timers.tick(499);

    assert.equal(cooldowns.get("a"), 1);
    t.mock.timers.tick(1);

    assert.equal(cooldowns.has("a"), false);
    assert.equal(cooldowns.get("a"), undefined);
    assert.equal(cooldowns.delete("a"), false);
    assert.equal(stored(), 2);
    assert.deepEqual(cooldowns.entries(), [
        ["b", 2],
        ["c", 3],
    ]);
    t.mock.timers.tick(1_500);

    assert.deepEqual(cooldowns.entries(), [["c", 3]]);
    assert.equal(stored(), 1);
    db.close();
});

test("a set without ttl makes the key permanent", t => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const db = open();
    const flags = db.kv("flags");

    flags.set("x", true, { ttl: 10 });
    flags.set("x", true);
    t.mock.timers.tick(1_000);

    assert.equal(flags.get("x"), true);
    flags.set("x", false, { ttl: 10 });
    t.mock.timers.tick(10);

    assert.equal(flags.has("x"), false);
    db.close();
});

test("clear counts only unexpired keys", t => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const db = open();
    const store = db.kv("store");

    store.set("old", 1, { ttl: 1 });
    store.set("new", 2);
    t.mock.timers.tick(5);

    assert.equal(store.clear(), 1);
    db.close();
});

test("ttl must be a positive, finite number of milliseconds", () => {
    const db = open();
    const store = db.kv("store");

    for (const ttl of [
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_VALUE,
    ]) {
        assert.throws(() => store.set("k", 1, { ttl }), {
            name: "RangeError",
            message:
                'The ttl for "k" in "store" must be a positive, finite number of milliseconds.',
        });
    }

    // @ts-expect-error ttl is a number
    assert.throws(() => store.set("k", 1, { ttl: "5" }), RangeError);
    assert.equal(store.has("k"), false);
    assert.equal(store.set("k", 1, { ttl: 0.5 }), 1);
    db.close();
});
