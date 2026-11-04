import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findProblems, fixSource } from "./check-layout.mjs";

const rules = source =>
    findProblems(source).map(({ rule, line }) => [rule, line]);
const code = lines => `${lines.join("\n")}\n`;

describe("layout problems", () => {
    test("braced if blocks need a blank line above and below", () => {
        assert.deepEqual(
            rules(
                code([
                    "const run = () => {",
                    "    const a = 1;",
                    "    if (a) {",
                    "        a;",
                    "    }",
                    "    a;",
                    "};",
                ]),
            ),
            [
                ["blank-around-if", 3],
                ["blank-around-if", 6],
            ],
        );
    });

    test("an if at the start or end of a body, or in an else chain, is fine", () => {
        assert.deepEqual(
            rules(
                code([
                    "const run = a => {",
                    "    if (a) {",
                    "        a;",
                    "    } else if (!a) {",
                    "        a;",
                    "    }",
                    "};",
                ]),
            ),
            [],
        );
    });

    test("consecutive blocks, returns, and long awaits need separating", () => {
        assert.deepEqual(
            rules(
                code([
                    "const run = async items => {",
                    "    for (const item of items) {",
                    "        item;",
                    "    }",
                    "    try {",
                    "        items;",
                    "    } catch {}",
                    "",
                    "    const value = await fetch(",
                    "        1,",
                    "        2,",
                    "    );",
                    "    items.push(value);",
                    "    return items;",
                    "};",
                ]),
            ),
            [
                ["blank-between-blocks", 5],
                ["blank-around-await", 13],
                ["blank-before-return", 14],
            ],
        );
    });

    test("inline if bodies are limited and loops need braces", () => {
        assert.deepEqual(
            rules(
                code([
                    "const run = (a, items) => {",
                    "    if (!a) return;",
                    "    if (a > 1) a = 1;",
                    "    if (a > 2) throw new Error();",
                    "    for (const item of items) item.run();",
                    "};",
                ]),
            ).map(([rule]) => rule),
            ["braces-inline-if", "braces-loop"],
        );
    });

    test("comments stay with the statement below them", () => {
        assert.deepEqual(
            rules(
                code([
                    "const run = a => {",
                    "    a; // trailing note",
                    "",
                    "    // Explains the check.",
                    "    if (a) {",
                    "        a;",
                    "    }",
                    "};",
                ]),
            ),
            [],
        );
    });

    test("TypeScript and JSX parse", () => {
        assert.deepEqual(
            rules("const view = (x: number) => <Card value={x} />;\n"),
            [],
        );
    });
});

describe("fixing", () => {
    test("fixes settle into a clean file", () => {
        const fixed = fixSource(
            code([
                "const run = (a, items) => {",
                "    const b = 1;",
                "    if (a) throw new Error();",
                "    for (const item of items) item.run();",
                "    return b;",
                "};",
            ]),
        );

        assert.deepEqual(findProblems(fixed), []);
        assert.match(fixed, /if \(a\) \{\s+throw new Error\(\);\s+\}/);
        assert.match(fixed, /\n\n {4}return b;/);
    });

    test("blank lines go above a statement's own comments", () => {
        assert.equal(
            fixSource(
                code([
                    "const run = a => {",
                    "    a;",
                    "    // Why.",
                    "    if (a) {",
                    "        a;",
                    "    }",
                    "};",
                ]),
            ),
            code([
                "const run = a => {",
                "    a;",
                "",
                "    // Why.",
                "    if (a) {",
                "        a;",
                "    }",
                "};",
            ]),
        );
    });
});
