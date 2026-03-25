"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { deleteSensor, getSensor, getSensorData, Sensor, SensorData } from "@/libs/actions";
import Button from "@/components/ui/button/Button";
import { TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import { parseSensorValue } from "@/libs/sensorValue";
import SensorFieldsLineChart, {
    type SensorFieldsLineChartSeries,
} from "@/components/charts/line/SensorFieldsLineChart";
import Checkbox from "@/components/form/input/Checkbox";

function formatCellValue(v: unknown) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);

    // Keep the table readable for object/array values.
    try {
        const s = JSON.stringify(v);
        return s.length > 500 ? `${s.slice(0, 500)}…` : s;
    } catch {
        return String(v);
    }
}

function formatLocalDateTime(v: unknown) {
    if (v === null || v === undefined) return "";

    // Accept Date/number(epochs)/string(ISO). Fall back to the original value if it doesn't parse.
    const d =
        v instanceof Date
            ? v
            : typeof v === "number"
                ? new Date(v)
                : typeof v === "string"
                    ? new Date(v)
                    : null;

    if (!d || Number.isNaN(d.getTime())) return formatCellValue(v);

    const pad2 = (n: number) => String(n).padStart(2, "0");

    const day = pad2(d.getDate());
    const month = pad2(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad2(d.getHours());
    const minutes = pad2(d.getMinutes());
    const seconds = pad2(d.getSeconds());

    // Local time: DD-MM-YYYY HH:mm:ss
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const LOCAL_TIME_COLUMNS = new Set(["created_at", "updated_at", "timestamp", "time"]);
const TIME_COLUMN_CANDIDATES = ["timestamp", "time", "created_at", "updated_at"];

function coerceNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function toEpochMs(v: unknown): number | null {
    if (v instanceof Date) {
        const t = v.getTime();
        return Number.isNaN(t) ? null : t;
    }
    if (typeof v === "number") {
        const d = new Date(v);
        const t = d.getTime();
        return Number.isNaN(t) ? null : t;
    }
    if (typeof v === "string") {
        const d = new Date(v);
        const t = d.getTime();
        return Number.isNaN(t) ? null : t;
    }
    return null;
}

export default function SensorPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { notify } = useNotification();
    const id = params?.id;

    const [sensor, setSensor] = useState<Sensor | null>(null);
    const [data, setData] = useState<SensorData>({ sensor: "", count: 0, items: [] });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Chart field selection (per sensor, persisted)
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [selectionTouched, setSelectionTouched] = useState(false);

    async function onDelete() {
        if (!id || !sensor) {
            notify({
                variant: "error",
                title: "Delete failed",
                message: "Missing sensor id.",
            });
            return;
        }

        const ok = window.confirm(
            `Delete sensor “${sensor.name}” (${sensor.sensor_id})? This can’t be undone.`,
        );
        if (!ok) return;

        setIsDeleting(true);
        try {
            await deleteSensor(id);
            notify({
                variant: "success",
                title: "Sensor deleted",
                message: `“${sensor.name}” was deleted successfully.`,
            });

            // No list page exists in this repo yet, so go back to where the user came from.
            router.back();
            router.refresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete sensor.";
            notify({ variant: "error", title: "Delete failed", message: msg });
        } finally {
            setIsDeleting(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setLoading(true);
            setError(null);
            try {
                const s = await getSensor(id);
                const res = await getSensorData(id, 100);

                if (cancelled) return;

                setSensor(s);
                setData({
                    sensor: res?.sensor ?? id,
                    count: typeof res?.count === "number" ? res.count : 0,
                    items: Array.isArray(res?.items) ? res.items : [],
                });
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load sensor.";
                setError(msg);
                setSensor(null);
                setData({ sensor: "", count: 0, items: [] });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id]);

    // Load persisted selection when sensor id changes.
    useEffect(() => {
        if (!id) return;
        setSelectionTouched(false);
        setSelectedFields([]);

        try {
            const raw = window.localStorage.getItem(`sensorChartFields:${id}`);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
                setSelectedFields(parsed);
            }
        } catch {
            // ignore
        }
    }, [id]);

    const normalizedRows = useMemo(() => {
        return (data.items ?? []).map((row) => {
            const r = row as any;
            const parsed = parseSensorValue(r?.value);

            const unpacked = parsed.raw !== r?.value && typeof parsed.raw === "object" && parsed.raw !== null;

            // If we successfully unpacked a JSON object from `value`, drop the original `value` field
            // so we don't show both the raw JSON string and the unpacked columns.
            const base = unpacked
                ? (() => {
                    const { value, ...rest } = r;
                    return rest;
                })()
                : r;

            return {
                ...base,
                ...parsed.fields,
                _parsedValue: parsed.raw,
                _unpackedValue: unpacked,
            };
        });
    }, [data.items]);

    const columns = useMemo(() => {
        const keys = new Set<string>();
        let anyUnpacked = false;

        for (const row of normalizedRows as any[]) {
            if (row?._unpackedValue) anyUnpacked = true;
            Object.keys(row || {}).forEach((k) => {
                if (k === "_parsedValue" || k === "_unpackedValue") return;
                keys.add(k);
            });
        }

        // If we unpacked at least one JSON object, the raw "value" column isn't useful.
        if (anyUnpacked) keys.delete("value");

        const preferredOrder = ["timestamp", "time", "created_at", "updated_at", "vbat", "temp", "humidity"];
        const ordered: string[] = [];
        for (const k of preferredOrder) {
            if (keys.has(k)) ordered.push(k);
        }
        for (const k of Array.from(keys).sort()) {
            if (!ordered.includes(k)) ordered.push(k);
        }
        return ordered;
    }, [normalizedRows]);

    const chart = useMemo(() => {
        if (!normalizedRows || normalizedRows.length === 0) return null;

        const timeKey = TIME_COLUMN_CANDIDATES.find((k) => columns.includes(k));
        if (!timeKey) return null;

        // Oldest -> newest for charts.
        const rows = [...(normalizedRows as any[])].reverse();

        const x = rows
            .map((r) => ({
                t: toEpochMs(r?.[timeKey]),
                row: r,
            }))
            .filter((p) => p.t !== null) as Array<{ t: number; row: any }>;

        if (x.length < 2) return null;

        const candidates = columns.filter(
            (c) => !LOCAL_TIME_COLUMNS.has(c) && c !== "id" && c !== "sensor" && c !== "sensor_id",
        );

        const seriesWithCounts: Array<{ series: SensorFieldsLineChartSeries; nonNull: number }> = [];

        for (const field of candidates) {
            let nonNull = 0;
            const dataPoints = x.map(({ t, row }) => {
                const y = coerceNumber(row?.[field]);
                if (y !== null) nonNull += 1;
                return { x: t, y };
            });

            // Keep only real numeric time series (at least 2 points)
            if (nonNull >= 2) {
                seriesWithCounts.push({ series: { name: field, data: dataPoints }, nonNull });
            }
        }

        if (seriesWithCounts.length === 0) return null;

        // Keep the most-populated series first.
        seriesWithCounts.sort((a, b) => b.nonNull - a.nonNull);

        const maxSeriesDefault = 8;
        const defaultFields = seriesWithCounts.slice(0, maxSeriesDefault).map((s) => s.series.name);

        return {
            timeKey,
            allSeries: seriesWithCounts.map((s) => s.series),
            availableFields: seriesWithCounts.map((s) => ({ name: s.series.name, nonNull: s.nonNull })),
            defaultFields,
            points: x.length,
            from: x[0].t,
            to: x[x.length - 1].t,
        };
    }, [columns, normalizedRows]);

    // If the user hasn't made a selection yet, auto-select the default top fields.
    useEffect(() => {
        if (!chart) return;
        if (selectionTouched) return;

        setSelectedFields((cur) => {
            // Keep anything already loaded from localStorage as long as it's still available.
            const available = new Set(chart.availableFields.map((f) => f.name));
            const filteredCur = (cur ?? []).filter((x) => available.has(x));
            if (filteredCur.length > 0) return filteredCur;
            return chart.defaultFields;
        });
    }, [chart, selectionTouched]);

    // Persist selection.
    useEffect(() => {
        if (!id) return;
        if (!selectionTouched) return;
        try {
            window.localStorage.setItem(`sensorChartFields:${id}`, JSON.stringify(selectedFields));
        } catch {
            // ignore
        }
    }, [id, selectedFields, selectionTouched]);

    const visibleSeries = useMemo(() => {
        if (!chart) return [] as SensorFieldsLineChartSeries[];
        const sel = new Set(selectedFields);
        return chart.allSeries.filter((s) => sel.has(s.name));
    }, [chart, selectedFields]);

    const selectionSummary = useMemo(() => {
        if (!chart) return null;
        const total = chart.availableFields.length;
        const selected = visibleSeries.length;
        return { total, selected };
    }, [chart, visibleSeries.length]);

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-5xl">
                    <div
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-5xl">
                    <div
                        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        {error}
                    </div>
                    <button
                        className="mt-4 text-sm text-gray-600 underline dark:text-gray-300"
                        onClick={() => router.back()}
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    if (!sensor) return null;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-5xl">
                <div className="mb-6 flex flex-row justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">{sensor.name}</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Sensor ID: <span className="font-mono">{sensor.sensor_id}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="ring-orange-600 bg-orange-100"
                            onClick={onDelete}
                            disabled={isDeleting}
                        >
                            <TrashBinIcon/>
                        </Button>
                    </div>
                </div>

                <ComponentCard
                    title="Sensor trends"
                    desc={
                        chart
                            ? `${chart.points} point${chart.points === 1 ? "" : "s"} • ${selectionSummary?.selected ?? 0} field${
                                (selectionSummary?.selected ?? 0) === 1 ? "" : "s"
                            }${
                                selectionSummary && selectionSummary.total > (selectionSummary.selected ?? 0)
                                    ? ` (of ${selectionSummary.total})`
                                    : ""
                            }`
                            : "No numeric time-series fields found."
                    }
                >
                    {chart ? (
                        <div className="space-y-3">
                            <div
                                className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                        Select fields to plot
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectionTouched(true);
                                                setSelectedFields(chart.defaultFields);
                                            }}
                                        >
                                            Top {chart.defaultFields.length}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectionTouched(true);
                                                setSelectedFields(chart.availableFields.map((f) => f.name));
                                            }}
                                        >
                                            All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectionTouched(true);
                                                setSelectedFields([]);
                                            }}
                                        >
                                            None
                                        </Button>
                                    </div>
                                </div>

                                <div className="pt-3 pr-2">
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                        {chart.availableFields.map((f) => {
                                            const checked = selectedFields.includes(f.name);
                                            return (
                                                <div key={f.name} className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={checked}
                                                        onChange={(next) => {
                                                            setSelectionTouched(true);
                                                            setSelectedFields((cur) => {
                                                                const set = new Set(cur);
                                                                if (next) set.add(f.name);
                                                                else set.delete(f.name);
                                                                return Array.from(set);
                                                            });
                                                        }}
                                                        label={`${f.name} (${f.nonNull})`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {visibleSeries.length > 10 ? (
                                    <div className="mt-2 text-xs text-orange-700 dark:text-orange-300">
                                        Many fields selected — the chart may get hard to read.
                                    </div>
                                ) : null}
                            </div>

                            {visibleSeries.length > 0 ? (
                                <div
                                    className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                                    <SensorFieldsLineChart series={visibleSeries}/>
                                </div>
                            ) : (
                                <div
                                    className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-gray-300">
                                    Select at least one field to plot.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-gray-300">
                            Nothing to plot yet.
                        </div>
                    )}
                </ComponentCard>

                <ComponentCard
                    title="Sensor values"
                    desc={`${data.items.length} row${data.items.length === 1 ? "" : "s"} (latest first)`}
                >
                    <div
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                        <div className="max-w-full overflow-x-auto">
                            <Table>
                                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                    <TableRow>
                                        {columns.length === 0 ? (
                                            <TableCell
                                                isHeader
                                                className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                                            >
                                                No columns
                                            </TableCell>
                                        ) : (
                                            columns.map((col) => (
                                                <TableCell
                                                    key={col}
                                                    isHeader
                                                    className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                                                >
                                                    {col}
                                                </TableCell>
                                            ))
                                        )}
                                    </TableRow>
                                </TableHeader>

                                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                    {normalizedRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                                                No values found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        normalizedRows.map((row: any, idx: number) => (
                                            <TableRow key={row?.id ?? row?.timestamp ?? row?.created_at ?? idx}>
                                                {columns.map((col) => (
                                                    <TableCell
                                                        key={col}
                                                        className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400"
                                                    >
                                                        {LOCAL_TIME_COLUMNS.has(col)
                                                            ? formatLocalDateTime(row?.[col])
                                                            : formatCellValue(row?.[col])}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </ComponentCard>
            </div>
        </div>
    );
}
