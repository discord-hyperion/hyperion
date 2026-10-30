import { execFileSync } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import path from "node:path";

const run = (command, args) =>
    execFileSync(command, args, { stdio: "inherit" });
run("pnpm", ["exec", "changeset", "version"]);

const files = [".changeset"];
for (const parent of ["packages", "apps"]) {
    for (const entry of await readdir(parent, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        for (const name of ["package.json", "CHANGELOG.md"]) {
            const filename = path.join(parent, entry.name, name);
            try {
                await access(filename);
                files.push(filename);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
    }
}
run("pnpm", ["exec", "biome", "check", "--write", ...files]);
run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"]);
