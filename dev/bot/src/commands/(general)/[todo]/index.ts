import { setTimeout } from "node:timers/promises";
import { ChatInputCommandBuilder } from "@discordjs/builders";
import { ParentCommand } from "@hyperion";
import {
    type InferInput,
    type InferOutput,
    isoTimestamp,
    maxLength,
    minLength,
    object,
    omit,
    optional,
    pick,
    pipe,
    string,
    trim,
} from "valibot";

export const idSchema = pipe(
    string(),
    trim(),
    minLength(2, "Min ID length is 2."),
    maxLength(10, "Max ID length is 10."),
);

export const todoSchema = object({
    id: idSchema,
    title: pipe(
        string(),
        minLength(1, "Min title length is 1."),
        maxLength(100, "Max title length is 100."),
    ),
    description: optional(
        pipe(
            string(),
            minLength(3, "Min description length is 3."),
            maxLength(100, "Max description length is 100."),
        ),
    ),
    deadline: pipe(string(), isoTimestamp()),
});

export const getTodoSchema = pick(todoSchema, ["id"]);
export const createTodoSchema = omit(todoSchema, ["id"]);

export type Todo = InferOutput<typeof todoSchema>;
export type CreateTodo = InferInput<typeof createTodoSchema>;

export const fakeApi = {
    getTodo: async (id: string): Promise<Todo | null> => {
        await setTimeout(1500);

        return {
            id,
            title: "Todo 1",
            description: "This is the todo description",
            deadline: "2026-10-30T00:00:00.000Z",
        } satisfies Todo;
    },

    createTodo: async ({ deadline, title, description }: CreateTodo) => {
        await setTimeout(1500);

        return {
            id: "1058925",
            title,
            deadline,
            description,
        } satisfies Todo;
    },
};

export default class extends ParentCommand {
    constructor() {
        super({
            builder: new ChatInputCommandBuilder()
                .setName("todo")
                .setDescription("Create and retrieve todos."),
        });
    }
}
