// Check the CODING_STANDARDS.md layout rules that Biome cannot express:
//   node scripts/check-layout.mjs [--fix] [files...]
// Without files it checks every tracked JavaScript and TypeScript file. --fix
// inserts the missing blank lines and braces; run Biome afterwards to format them.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const blocks = new Set([
    "ForStatement",
    "ForOfStatement",
    "ForInStatement",
    "WhileStatement",
    "DoWhileStatement",
    "TryStatement",
    "SwitchStatement",
]);
const loops = new Set([
    "ForStatement",
    "ForOfStatement",
    "ForInStatement",
    "WhileStatement",
    "DoWhileStatement",
]);

export const messages = {
    "blank-around-if": "Put a blank line around a braced if block.",
    "blank-between-blocks": "Put a blank line between consecutive blocks.",
    "blank-before-return":
        "Put a blank line before a return that follows other statements.",
    "blank-around-await":
        "Put a blank line around an awaited call of four or more lines.",
    "braces-inline-if":
        "Brace this if body; inline bodies are only return, break, continue, or an assignment.",
    "braces-loop": "Brace this loop body.",
};

const bracedIf = node =>
    node.type === "IfStatement" && node.consequent.type === "BlockStatement";
const isBlock = node => bracedIf(node) || blocks.has(node.type);
const inlineAllowed = node =>
    node.type === "ReturnStatement" ||
    node.type === "BreakStatement" ||
    node.type === "ContinueStatement" ||
    (node.type === "ExpressionStatement" &&
        node.expression.type === "AssignmentExpression");

const multiLineAwait = node => {
    if (node.loc.end.line - node.loc.start.line < 3) return false;

    const expression =
        node.type === "ExpressionStatement"
            ? node.expression
            : node.type === "VariableDeclaration" &&
                node.declarations.length === 1
              ? node.declarations[0].init
              : null;

    return expression?.type === "AwaitExpression";
};

/** The layout problems in one source file, each with how to fix it. */
export const findProblems = source => {
    const ast = parse(source, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
    });
    const lines = source.split("\n");
    const blankLines = new Set(
        lines.flatMap((line, index) => (line.trim() === "" ? [index + 1] : [])),
    );
    // Only comments on their own lines belong to the statement below them.
    const comments = (ast.comments ?? []).filter(comment =>
        /^\s*(\/\/|\/\*)/.test(lines[comment.loc.start.line - 1]),
    );
    const problems = [];

    // A statement's first line, including the comments directly above it.
    const startOf = node => {
        let line = node.loc.start.line;

        for (;;) {
            const comment = comments.find(
                item => item.loc.end.line === line - 1,
            );

            if (!comment) return line;

            line = comment.loc.start.line;
        }
    };
    const separated = (before, after) => {
        for (
            let line = before.loc.end.line + 1;
            line < startOf(after);
            line++
        ) {
            if (blankLines.has(line)) return true;
        }

        return false;
    };
    const blankAbove = (rule, node) =>
        problems.push({
            rule,
            line: node.loc.start.line,
            fix: { blankBefore: startOf(node) },
        });

    const checkStatements = list => {
        for (const [index, statement] of list.entries()) {
            const previous = list[index - 1];
            const next = list[index + 1];

            if (previous && !separated(previous, statement)) {
                if (bracedIf(statement)) {
                    blankAbove("blank-around-if", statement);
                } else if (isBlock(statement) && isBlock(previous)) {
                    blankAbove("blank-between-blocks", statement);
                } else if (statement.type === "ReturnStatement") {
                    blankAbove("blank-before-return", statement);
                } else if (
                    multiLineAwait(statement) ||
                    multiLineAwait(previous)
                ) {
                    blankAbove("blank-around-await", statement);
                }
            }

            if (next && bracedIf(statement) && !separated(statement, next)) {
                blankAbove("blank-around-if", next);
            }
        }
    };

    const visit = node => {
        if (!node || typeof node.type !== "string") return;

        if (
            node.type === "Program" ||
            node.type === "BlockStatement" ||
            node.type === "StaticBlock"
        ) {
            checkStatements(node.body);
        }

        if (node.type === "SwitchCase") {
            checkStatements(node.consequent);
        }

        if (node.type === "IfStatement") {
            for (const branch of [node.consequent, node.alternate]) {
                if (
                    branch &&
                    branch.type !== "BlockStatement" &&
                    branch.type !== "IfStatement" &&
                    !inlineAllowed(branch)
                ) {
                    problems.push({
                        rule: "braces-inline-if",
                        line: branch.loc.start.line,
                        fix: { wrap: [branch.start, branch.end] },
                    });
                }
            }
        }

        if (loops.has(node.type) && node.body.type !== "BlockStatement") {
            problems.push({
                rule: "braces-loop",
                line: node.body.loc.start.line,
                fix: { wrap: [node.body.start, node.body.end] },
            });
        }

        for (const [key, value] of Object.entries(node)) {
            if (key === "loc" || key.endsWith("Comments")) continue;

            for (const child of Array.isArray(value) ? value : [value]) {
                if (child && typeof child.type === "string") {
                    visit(child);
                }
            }
        }
    };

    visit(ast.program);

    return problems;
};

/** Apply one round of fixes: braces first, since they move every later line. */
const fixOnce = (source, problems) => {
    const wraps = problems
        .flatMap(problem => (problem.fix.wrap ? [problem.fix.wrap] : []))
        .sort((a, b) => b[0] - a[0]);

    if (wraps.length > 0) {
        let text = source;

        for (const [start, end] of wraps) {
            text = `${text.slice(0, start)}{\n${text.slice(start, end)}\n}${text.slice(end)}`;
        }

        return text;
    }

    const before = new Set(problems.map(problem => problem.fix.blankBefore));
    const lines = source.split("\n");

    return lines
        .flatMap((line, index) =>
            before.has(index + 1) && lines[index - 1]?.trim() !== ""
                ? ["", line]
                : [line],
        )
        .join("\n");
};

/** Fix every layout problem; the result still needs Biome formatting. */
export const fixSource = source => {
    let text = source;

    for (let round = 0; round < 10; round++) {
        const problems = findProblems(text);

        if (problems.length === 0) return text;

        text = fixOnce(text, problems);
    }

    throw new Error("Layout fixes did not settle after 10 rounds.");
};

const sourceFiles = root =>
    execFileSync(
        "git",
        ["ls-files", "-z", "*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs"],
        { cwd: root, encoding: "utf8" },
    )
        .split("\0")
        .filter(Boolean)
        .map(file => path.join(root, file));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const args = process.argv.slice(2);
    const fix = args.includes("--fix");
    const named = args.filter(arg => arg !== "--fix");
    const files = named.length > 0 ? named : sourceFiles(root);
    const report = [];

    for (const file of files) {
        const source = readFileSync(file, "utf8");
        const relative = path.relative(root, path.resolve(file));

        if (fix) {
            const fixed = fixSource(source);

            if (fixed !== source) {
                writeFileSync(file, fixed);
            }

            continue;
        }

        for (const { rule, line } of findProblems(source)) {
            report.push(`${relative}:${line} ${rule}: ${messages[rule]}`);
        }
    }

    if (report.length > 0) {
        console.error(report.join("\n"));
        console.error(
            `\n${report.length} layout problem(s). Run \`pnpm check:fix\` to fix them.`,
        );
        process.exit(1);
    }

    if (!fix) {
        console.log(`Checked layout of ${files.length} files.`);
    }
}
