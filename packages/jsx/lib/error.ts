export class JSXRenderError extends Error {
    constructor(
        readonly path: string,
        message: string,
        options?: ErrorOptions,
    ) {
        super(`${path}: ${message}`, options);
        this.name = "JSXRenderError";
    }
}
