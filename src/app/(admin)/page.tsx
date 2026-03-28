"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getBranches, getBranchSensors, getSensorData, type Sensor } from "@/libs/actions";
import { onBranchesChanged } from "@/libs/branchEvents";
import { deriveAlertBadge } from "@/libs/branchStatus";
import { parseSensorValue } from "@/libs/sensorValue";
import { formatLocalDateTime, toEpochMs } from "@/app/(admin)/(others-pages)/sensors/[id]/page";

type Branch = {
    branch_id: string;
    group_id?: string;
    name: string;
    alert?: unknown;
};

type SensorLatest = {
    sensor: Sensor;
    branch: { branch_id: string; name: string };
    latest: null | { created_at?: string; timestamp?: string; time?: string; updated_at?: string; value?: unknown };
};

type ParsedValuePreview =
    | { kind: "empty" }
    | { kind: "scalar"; text: string }
    | { kind: "json"; preview: Array<{ k: string; v: string }> };

function formatCellValue(v: unknown) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    try {
        const s = JSON.stringify(v);
        return s.length > 200 ? `${s.slice(0, 200)}…` : s;
    } catch {
        return String(v);
    }
}

function clampText(s: string, max: number) {
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
}

function buildValuePreview(parsed: ReturnType<typeof parseSensorValue>): ParsedValuePreview {
    // If it's a scalar payload, keep it simple.
    const scalar = parsed.fields?.value;
    if (scalar !== undefined) {
        const txt = formatCellValue(scalar);
        return txt ? { kind: "scalar", text: clampText(txt, 120) } : { kind: "empty" };
    }

    const entries = Object.entries(parsed.fields ?? {});
    if (entries.length === 0) return { kind: "empty" };

    // Show up to 4 key/value pairs as a compact preview.
    const preview = entries
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 4)
        .map(([k, v]) => ({ k, v: clampText(formatCellValue(v), 60) }));

    return { kind: "json", preview };
}

function PrettySensorValue({ value }: { value: unknown }) {
    const parsed = parseSensorValue(value);
    const preview = buildValuePreview(parsed);

    if (preview.kind === "empty") {
        return <span className="text-xs text-gray-500 dark:text-gray-400">—</span>;
    }

    if (preview.kind === "scalar") {
        return (
            <span className="font-mono text-xs text-gray-700 dark:text-gray-200" title={formatCellValue(parsed.raw)}>
                {preview.text}
            </span>
        );
    }

    // JSON object payload: render as compact chips.
    return (
        <div className="flex flex-wrap gap-1" title={formatCellValue(parsed.raw)}>
            {preview.preview.map(({ k, v }) => (
                <span
                    key={k}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-200"
                >
                    <span className="text-gray-500 dark:text-gray-400">{k}:</span> {v || "—"}
                </span>
            ))}
            {Object.keys(parsed.fields ?? {}).length > preview.preview.length ? (
                <span
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
                    +{Object.keys(parsed.fields ?? {}).length - preview.preview.length}
                </span>
            ) : null}
        </div>
    );
}

function newestFirstSort<T extends { latest: SensorLatest["latest"] }>(rows: T[]): T[] {
    const getTime = (r: any) =>
        toEpochMs(r?.latest?.timestamp) ??
        toEpochMs(r?.latest?.time) ??
        toEpochMs(r?.latest?.created_at) ??
        toEpochMs(r?.latest?.updated_at) ??
        0;

    return [...rows].sort((a, b) => getTime(b) - getTime(a));
}

async function mapWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const idx = nextIndex++;
            if (idx >= items.length) return;
            out[idx] = await mapper(items[idx], idx);
        }
    }

    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
    await Promise.all(workers);
    return out;
}

export default function Page() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sensorLatest, setSensorLatest] = useState<SensorLatest[]>([]);
    const [sensorInitialLoading, setSensorInitialLoading] = useState(true);
    const [sensorRefreshing, setSensorRefreshing] = useState(false);
    const [sensorError, setSensorError] = useState<string | null>(null);
    const [sensorLastUpdatedAt, setSensorLastUpdatedAt] = useState<number | null>(null);

    const sensorRequestIdRef = useRef(0);

    const loadBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = (await getBranches()) as any;
            const items = (res?.data ?? []) as Branch[];
            setBranches(Array.isArray(items) ? items : []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to fetch branches.";
            setError(msg);
            setBranches([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadAllSensorLatest = useCallback(
        async ({ reason }: { reason: "initial" | "refresh" | "event" } = { reason: "refresh" }) => {
            const requestId = ++sensorRequestIdRef.current;

            if (reason === "initial") {
                setSensorInitialLoading(true);
            } else {
                // For refresh/event, keep existing rows rendered and just show a subtle refreshing state.
                setSensorRefreshing(true);
            }

            setSensorError(null);

            try {
                const res = (await getBranches()) as any;
                const branchItems = (res?.data ?? []) as Branch[];
                const branchesSafe = Array.isArray(branchItems) ? branchItems : [];

                // 1) Fetch sensors for each branch (small fan-out)
                const sensorsByBranch = await mapWithConcurrencyLimit(
                    branchesSafe,
                    6,
                    async (b) => {
                        const data = await getBranchSensors(b.branch_id);
                        const sensors = Array.isArray(data?.items) ? (data.items as Sensor[]) : [];
                        return { branch: { branch_id: b.branch_id, name: b.name }, sensors };
                    },
                );

                const allSensors: { branch: { branch_id: string; name: string }; sensor: Sensor }[] = [];
                for (const entry of sensorsByBranch) {
                    for (const s of entry.sensors) allSensors.push({ branch: entry.branch, sensor: s });
                }

                // 2) Fetch latest value for each sensor (bigger fan-out) with a strict concurrency limit
                const latestRows = await mapWithConcurrencyLimit(allSensors, 10, async ({ branch, sensor }) => {
                    try {
                        const data = await getSensorData(sensor.sensor_id, 1);
                        const first = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as any) : null;
                        return { sensor, branch, latest: first } satisfies SensorLatest;
                    } catch {
                        // One sensor failing shouldn't kill the whole dashboard.
                        return { sensor, branch, latest: null } satisfies SensorLatest;
                    }
                });

                // Ignore out-of-order responses (e.g., a slow poll finishing after a newer one).
                if (sensorRequestIdRef.current !== requestId) return;

                setSensorLatest(newestFirstSort(latestRows));
                setSensorLastUpdatedAt(Date.now());
            } catch (e) {
                if (sensorRequestIdRef.current !== requestId) return;

                const msg = e instanceof Error ? e.message : "Failed to load sensors.";
                setSensorError(msg);

                // Important: don't clear previous data during refresh; it causes a visual flash.
                // If this was the very first load and we have no data, keep empty state.
                if (reason === "initial" && sensorLatest.length === 0) {
                    setSensorLatest([]);
                }
            } finally {
                if (sensorRequestIdRef.current !== requestId) return;
                setSensorInitialLoading(false);
                setSensorRefreshing(false);
            }
        },
        [sensorLatest.length],
    );

    useEffect(() => {
        let cancelled = false;

        loadBranches().catch((e) => {
            if (cancelled) return;
            console.error(e);
        });
        loadAllSensorLatest({ reason: "initial" }).catch((e) => {
            if (cancelled) return;
            console.error(e);
        });

        return () => {
            cancelled = true;
        };
    }, [loadBranches, loadAllSensorLatest]);

    useEffect(() => {
        return onBranchesChanged(() => {
            loadBranches().catch((e) => console.error(e));
            loadAllSensorLatest({ reason: "event" }).catch((e) => console.error(e));
        });
    }, [loadBranches, loadAllSensorLatest]);

    const sensorSummary = useMemo(() => {
        const total = sensorLatest.length;
        const withReading = sensorLatest.filter((s) => s.latest && s.latest.value !== undefined).length;
        const noReading = total - withReading;
        return { total, withReading, noReading };
    }, [sensorLatest]);

    // Polling for latest sensor readings
    useEffect(() => {
        let timer: any = null;
        let cancelled = false;

        const intervalMs = 15_000;

        async function tick() {
            if (cancelled) return;
            // Pause polling if the tab is hidden (saves API + CPU)
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            await loadAllSensorLatest({ reason: "refresh" });
        }

        timer = setInterval(() => {
            tick().catch((e) => console.error(e));
        }, intervalMs);

        function onVisibilityChange() {
            if (document.visibilityState === "visible") {
                tick().catch((e) => console.error(e));
            }
        }

        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [loadAllSensorLatest]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Branch status</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        All branches and their current alert status.
                    </p>
                </div>

                <ComponentCard
                    title={`All sensors (latest readings)${!sensorInitialLoading ? ` (${sensorSummary.total})` : ""}`}
                    desc={
                        sensorInitialLoading
                            ? "Loading sensor readings…"
                            : sensorError
                                ? sensorLatest.length > 0
                                    ? `Refresh failed (showing last known data). ${sensorError}`
                                    : sensorError
                                : sensorSummary.total === 0
                                    ? "No sensors found."
                                    : ``
                    }
                    className="border-2"
                >
                    {!sensorInitialLoading && sensorLatest.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b border-gray-100 dark:border-gray-800">
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Branch
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Sensor
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Current value
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Updated
                                        </TableCell>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {sensorLatest.map((row) => {
                                        const ts =
                                            row.latest?.timestamp ??
                                            row.latest?.time ??
                                            row.latest?.created_at ??
                                            row.latest?.updated_at;

                                        return (
                                            <TableRow
                                                key={row.sensor.sensor_id}
                                                className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                                            >
                                                <TableCell className="px-3 py-3">
                                                    <Link
                                                        href={`/branches/${encodeURIComponent(row.branch.branch_id)}`}
                                                        className="text-sm font-medium text-gray-800 hover:underline dark:text-white/90"
                                                    >
                                                        {row.branch.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <Link
                                                        href={`/sensors/${encodeURIComponent(row.sensor.sensor_id)}`}
                                                        className="text-sm font-medium text-gray-800 hover:underline dark:text-white/90"
                                                    >
                                                        {row.sensor.name}
                                                    </Link>
                                                    <div
                                                        className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                                        {row.sensor.sensor_id}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    {row.latest ? (
                                                        <PrettySensorValue value={row.latest?.value}/>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            No reading yet
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <span className="text-xs text-gray-600 dark:text-gray-300">
                                                        {ts ? formatLocalDateTime(ts) : ""}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                </ComponentCard>

                <ComponentCard
                    title={`Branches${!loading ? ` (${branches.length})` : ""}`}
                    desc={
                        loading
                            ? "Loading…"
                            : error
                                ? error
                                : branches.length === 0
                                    ? "No branches found."
                                    : ""
                    }
                >
                    {!loading && !error && branches.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b border-gray-100 dark:border-gray-800">
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Branch
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            ID
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Status
                                        </TableCell>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {branches.map((b) => {
                                        const badge = deriveAlertBadge(b.alert);
                                        return (
                                            <TableRow
                                                key={b.branch_id}
                                                className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                                            >
                                                <TableCell className="px-3 py-3">
                                                    <Link
                                                        href={`/branches/${encodeURIComponent(b.branch_id)}`}
                                                        className="font-medium text-gray-800 hover:underline dark:text-white/90"
                                                    >
                                                        {b.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <span
                                                        className="font-mono text-xs text-gray-600 dark:text-gray-300">
                                                        {b.branch_id}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <span title={badge.title} className="inline-flex whitespace-nowrap">
                                                        <Badge color={badge.color} variant={badge.variant} size="sm">
                                                            {badge.label}
                                                        </Badge>
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                </ComponentCard>
            </div>
        </div>
    );
}
