/** Names of the commands that a deployment would add, remove, or change. */
export type CommandChanges = {
    added: string[];
    removed: string[];
    changed: string[];
    /** For each changed command, the paths of the fields that differ. */
    differences: Record<string, string[]>;
};

// Fields Discord sets on its side, never sent in a deployment.
const serverFields = new Set([
    "id",
    "application_id",
    "guild_id",
    "version",
    "name_localized",
    "description_localized",
]);

// Fields Discord applies only to global commands; a guild scope ignores them
// and doesn't return what was sent.
const globalOnlyFields = new Set([
    "contexts",
    "integration_types",
    "dm_permission",
]);

// Values Discord assumes when a field is missing, so missing and default match.
const defaults: Record<string, unknown> = {
    nsfw: false,
    dm_permission: true,
    default_permission: true,
    integration_types: [0],
    contexts: [0, 1, 2],
    required: false,
    autocomplete: false,
};

const isEmpty = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0);

const normalize = (
    value: unknown,
    top?: { readonly guild: boolean },
): unknown => {
    if (Array.isArray(value)) {
        const items = value.map(item => normalize(item));

        // Arrays of numbers are sets here (contexts, channel types), so
        // Discord's order doesn't count as a change.
        return items.every(item => typeof item === "number")
            ? [...items].sort((a, b) => (a as number) - (b as number))
            : items;
    }

    if (typeof value !== "object" || value === null) return value;

    const entries: [string, unknown][] = [];

    for (const key of Object.keys(value).sort()) {
        if (top && serverFields.has(key)) continue;
        if (top?.guild && globalOnlyFields.has(key)) continue;

        const field = normalize((value as Record<string, unknown>)[key]);

        if (isEmpty(field)) continue;
        if (key in defaults && same(field, normalize(defaults[key]))) continue;

        entries.push([key, field]);
    }

    return Object.fromEntries(entries);
};

const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);

const differingPaths = (a: unknown, b: unknown, at = ""): string[] => {
    if (same(a, b)) return [];

    const objects =
        typeof a === "object" &&
        a !== null &&
        typeof b === "object" &&
        b !== null;

    if (!objects || Array.isArray(a) !== Array.isArray(b)) return [at || "."];

    if (Array.isArray(a) && Array.isArray(b)) {
        const length = Math.max(a.length, b.length);

        return Array.from({ length }, (_, index) =>
            differingPaths(a[index], b[index], `${at}[${index}]`),
        ).flat();
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    return [...keys].flatMap(key =>
        differingPaths(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
            at ? `${at}.${key}` : key,
        ),
    );
};

const byKey = (commands: readonly object[], scope: { guild: boolean }) => {
    const keyed = new Map<string, { name: string; command: unknown }>();

    for (const command of commands) {
        const { name, type } = command as { name: string; type?: number };

        keyed.set(`${type ?? 1}:${name}`, {
            name,
            command: normalize(command, scope),
        });
    }

    return keyed;
};

/**
 * Compare a deployment body with the commands Discord already has, ignoring
 * server-side fields, defaults, the order of commands, and in a guild scope,
 * the fields that apply only to global commands.
 */
export const commandChanges = (
    local: readonly object[],
    remote: readonly object[],
    scope: { readonly guild: boolean },
): CommandChanges => {
    const wanted = byKey(local, scope);
    const registered = byKey(remote, scope);
    const changes: CommandChanges = {
        added: [],
        removed: [],
        changed: [],
        differences: {},
    };

    for (const [key, { name, command }] of wanted) {
        const current = registered.get(key);

        if (!current) {
            changes.added.push(name);
        } else if (!same(command, current.command)) {
            changes.changed.push(name);
            changes.differences[name] = differingPaths(
                command,
                current.command,
            );
        }
    }

    for (const [key, { name }] of registered) {
        if (!wanted.has(key)) {
            changes.removed.push(name);
        }
    }

    return changes;
};
