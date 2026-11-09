import type { StandardSchemaV1 } from "@standard-schema/spec";

/** A row or stored value that failed its schema. Nothing was written. */
export class RowValidationError extends Error {
    readonly issues: readonly StandardSchemaV1.Issue[];

    /** `subject` names what failed, such as `A "todos" row`. */
    constructor(subject: string, issues: readonly StandardSchemaV1.Issue[]) {
        super(
            `${subject} failed validation: ${issues.map(issue => issue.message).join("; ")}`,
        );
        this.name = "RowValidationError";
        this.issues = issues;
    }
}

/** Validate synchronously: SQLite calls never await, so async schemas can't run. */
export const validate = <Schema extends StandardSchemaV1>(
    schema: Schema,
    value: unknown,
    subject: string,
): StandardSchemaV1.InferOutput<Schema> => {
    const result = schema["~standard"].validate(value);

    if (result instanceof Promise) {
        result.catch(() => {});

        throw new TypeError(
            `${subject} uses a schema that validates asynchronously; @hyperion-js/sqlite needs a synchronous schema.`,
        );
    }

    if (result.issues) {
        throw new RowValidationError(subject, result.issues);
    }

    return result.value;
};
