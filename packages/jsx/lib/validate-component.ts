import { JSXRenderError } from "./error.ts";

export const validateComponent = (
    builder: { toJSON: () => unknown },
    path: string,
) => {
    try {
        builder.toJSON();
    } catch (cause) {
        throw new JSXRenderError(
            path,
            "Native component builder validation failed.",
            { cause },
        );
    }
};
