import type { StandardSchemaV1 } from "@standard-schema/spec";

/** A row that failed its schema. Nothing was written. */
export class RowValidationError extends Error {
    readonly issues: readonly StandardSchemaV1.Issue[];

    constructor(table: string, issues: readonly StandardSchemaV1.Issue[]) {
        super(
            `A ${table} row failed validation: ${issues.map(issue => issue.message).join("; ")}`,
        );
        this.name = "RowValidationError";
        this.issues = issues;
    }
}

/** Validate synchronously: SQLite calls never await, so async schemas can't run. */
export const validate = <Schema extends StandardSchemaV1>(
    schema: Schema,
    value: unknown,
    table: string,
): StandardSchemaV1.InferOutput<Schema> => {
    const result = schema["~standard"].validate(value);

    if (result instanceof Promise) {
        result.catch(() => {});

        throw new TypeError(
            `The ${table} schema validates asynchronously; @hyperion/sqlite needs a synchronous schema.`,
        );
    }

    if (result.issues) {
        throw new RowValidationError(table, result.issues);
    }

    return result.value;
};
