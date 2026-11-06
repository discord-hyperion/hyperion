import { createDatabase } from "@hyperion/sqlite";
import * as v from "valibot";

// Without DATABASE_PATH, todos last until the bot stops; tests rely on that.
export const db = createDatabase({
    path: process.env.DATABASE_PATH || ":memory:",
    migrations: [
        `CREATE TABLE todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            deadline TEXT NOT NULL
        )`,
    ],
});

export const todos = db.table(
    "todos",
    v.object({
        id: v.string(),
        title: v.string(),
        description: v.nullable(v.string()),
        deadline: v.string(),
    }),
    { key: "id" },
);
