export type ParsedSensorValue = {
    /** Flattened key/value pairs extracted from the sensor's `value` field. */
    fields: Record<string, unknown>;
    /** The original value (string/number/object/...) after a best-effort JSON parse. */
    raw: unknown;
};

export function looksLikeJsonString(v: string) {
    const s = v.trim();
    return (s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"));
}

export function tryParseJson(v: string): unknown {
    if (!looksLikeJsonString(v)) return v;
    try {
        return JSON.parse(v);
    } catch {
        return v;
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Flattens objects into dot-notation keys.
 * Example: { a: { b: 1 } } => { "a.b": 1 }
 */
export function flattenObject(
    input: unknown,
    options?: { maxDepth?: number; prefix?: string },
): Record<string, unknown> {
    const maxDepth = options?.maxDepth ?? 6;
    const rootPrefix = options?.prefix ?? "";

    const out: Record<string, unknown> = {};

    function rec(value: unknown, prefix: string, depth: number) {
        if (depth > maxDepth) {
            out[prefix] = value;
            return;
        }

        if (Array.isArray(value)) {
            // Keep arrays as-is; flattening arrays into keys tends to create noisy columns.
            out[prefix] = value;
            return;
        }

        if (isPlainObject(value)) {
            const entries = Object.entries(value);
            if (entries.length === 0) {
                out[prefix] = value;
                return;
            }
            for (const [k, v] of entries) {
                const nextPrefix = prefix ? `${prefix}.${k}` : k;
                rec(v, nextPrefix, depth + 1);
            }
            return;
        }

        out[prefix] = value;
    }

    if (rootPrefix) {
        rec(input, rootPrefix, 0);
    } else if (isPlainObject(input)) {
        for (const [k, v] of Object.entries(input)) {
            rec(v, k, 0);
        }
    } else {
        // Not an object, so treat as a single value.
        out.value = input;
    }

    return out;
}

/**
 * Parses the `value` field of a sensor row.
 * - If it's a JSON string, it becomes an object/array
 * - If it's already an object, it's used as-is
 * - The result is flattened into `fields` (dot-notation)
 */
export function parseSensorValue(value: unknown): ParsedSensorValue {
    const raw = typeof value === "string" ? tryParseJson(value) : value;

    // If the payload is a plain object, promote its keys to columns.
    if (isPlainObject(raw)) {
        return { raw, fields: flattenObject(raw) };
    }

    // Arrays (or scalars) stay in a single column.
    return { raw, fields: { value: raw } };
}
