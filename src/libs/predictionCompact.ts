import { tryParseJson } from "@/libs/sensorValue";

export type PredictionMetric = "co2" | "temp" | "rh";

export type BranchPrediction = {
    model_id: string;
    model_version: string;
    horizon: number;
    step_ahead: number;
    predictions: Record<PredictionMetric, number[]>;
};

function normalizeKey(k: string) {
    return k.trim().toLowerCase();
}

function inferMetricFromKeys(keys: string[]): PredictionMetric | null {
    const k = keys.map(normalizeKey);

    // CO2
    if (k.some((x) => x === "co2" || x === "co₂" || x.endsWith(".co2") || x.endsWith(".co₂"))) return "co2";

    // Temperature
    if (
        k.some(
            (x) =>
                x === "temp" ||
                x === "temperature" ||
                x.endsWith(".temp") ||
                x.endsWith(".temperature"),
        )
    )
        return "temp";

    // Relative humidity
    if (
        k.some(
            (x) =>
                x === "rh" ||
                x === "humidity" ||
                x.endsWith(".rh") ||
                x.endsWith(".humidity"),
        )
    )
        return "rh";

    return null;
}

export function inferPredictionMetricFromSensor(
    sensor: { name?: string } | null | undefined,
    latestValue: unknown,
): PredictionMetric | null {
    // 1) Try value keys first (most reliable when payload is JSON)
    let v = latestValue;
    if (typeof v === "string") v = tryParseJson(v);

    if (v && typeof v === "object" && !Array.isArray(v)) {
        const metric = inferMetricFromKeys(Object.keys(v as Record<string, unknown>));
        if (metric) return metric;

        // Also inspect 1-level nested objects (common payload shape: { data: { co2: ... } })
        for (const nested of Object.values(v as Record<string, unknown>)) {
            if (nested && typeof nested === "object" && !Array.isArray(nested)) {
                const m2 = inferMetricFromKeys(Object.keys(nested as Record<string, unknown>));
                if (m2) return m2;
            }
        }
    }

    // 2) Fallback: infer from sensor name
    const n = normalizeKey(sensor?.name ?? "");
    if (!n) return null;
    if (n.includes("co2") || n.includes("co₂")) return "co2";
    if (n.includes("temp") || n.includes("temperature")) return "temp";
    if (n.includes("rh") || n.includes("humidity")) return "rh";

    return null;
}

export function getPredictionSeries(
    prediction: BranchPrediction | null | undefined,
    metric: PredictionMetric,
): number[] | null {
    const raw: any = prediction?.predictions;
    const rec: any = Array.isArray(raw) ? raw[0] : raw;
    const arr = rec?.[metric];
    return Array.isArray(arr) ? arr.filter((v: any) => typeof v === "number" && Number.isFinite(v)) : null;
}

export function formatPredictedValue(v: number | null | undefined, decimals: number): string {
    if (typeof v !== "number" || !Number.isFinite(v)) return "—";
    return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}
