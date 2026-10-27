export type RegistryBaseClass<Instance> = {
    readonly prototype: Instance;
    readonly name: string;
    [Symbol.hasInstance](value: unknown): boolean;
};

export const assertRegistryClass: <Instance>(
    defaultExport: unknown,
    baseClass: RegistryBaseClass<Instance>,
) => asserts defaultExport is new () => Instance = (
    defaultExport,
    baseClass,
) => {
    if (
        typeof defaultExport !== "function" ||
        !(defaultExport.prototype instanceof baseClass)
    ) {
        throw new TypeError(
            `Expected a default-exported class extending ${baseClass.name}.`,
        );
    }
};
