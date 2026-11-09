import { ChatInputCommandBuilder } from "@discordjs/builders";
import { defineParentCommand } from "@hyperion-js/core";
import {
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

export default defineParentCommand({
    builder: new ChatInputCommandBuilder()
        .setName("todo")
        .setDescription("Create and retrieve todos."),
});
