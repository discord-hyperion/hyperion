import type {
    ParamsDefinition,
    ParamsResult,
} from "../components/custom-id-params.ts";

/** Validate decoded custom-ID values before guards and the handler run. */
export const resolveParams = async <Params extends ParamsDefinition>(
    params: Params,
    raw: Readonly<Record<string, string>>,
): Promise<ParamsResult<Params>> => {
    const result = await params.schema["~standard"].validate(raw);

    return result.issues === undefined
        ? [null, result.value]
        : [result.issues, undefined];
};
