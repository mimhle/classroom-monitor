"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { deleteSensor, getSensor, getSensorData, Sensor, SensorData, updateSensor } from "@/libs/actions";
import Button from "@/components/ui/button/Button";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import { parseSensorValue } from "@/libs/sensorValue";
import SensorFieldsLineChart, {
    type SensorFieldsLineChartSeries,
} from "@/components/charts/line/SensorFieldsLineChart";
import Checkbox from "@/components/form/input/Checkbox";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import DateTimeRangePicker, { type DateTimeRange } from "@/components/form/DateTimeRangePicker";
import { getCurrentUser } from "@/libs/auth";
import { isAdminOrSuperadmin } from "@/libs/roles";

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

function rowKey(row: any): string {
    if (!row) return "";
    const id = row?.id;
    if (id !== null && id !== undefined && id !== "") return String(id);
    const createdAt = row?.created_at ?? row?.timestamp ?? row?.time ?? "";
    const value = row?.value ?? "";
    return `${String(createdAt)}|${String(value)}`;
}

function newestFirstSort(rows: any[]): any[] {
    const getTime = (r: any) =>
        toEpochMs(r?.timestamp) ?? toEpochMs(r?.time) ?? toEpochMs(r?.created_at) ?? toEpochMs(r?.updated_at) ?? 0;
    return rows.sort((a, b) => getTime(b) - getTime(a));
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

    const pollingRef = useRef<{ timer: any; stop: boolean; inFlight: boolean }>({
        timer: null,
        stop: false,
        inFlight: false,
    });

    // Edit sensor modal (Branch-style)
    const editSensorModal = useModal(false);
    const [sensorName, setSensorName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Chart field selection (per sensor, persisted)
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [selectionTouched, setSelectionTouched] = useState(false);

    // Time range filter (per sensor, persisted). Sent to API as ISO 8601.
    // We keep a draft range (what the picker currently shows) separate from an applied range
    // (what the API actually uses) to avoid data reloading while the user is still selecting time.
    const [draftRange, setDraftRange] = useState<DateTimeRange>({ from: null, to: null });
    const [appliedRange, setAppliedRange] = useState<DateTimeRange>({ from: null, to: null });
    const [isRangeLoading, setIsRangeLoading] = useState(false);

    // Range result limit selector (per sensor). null => "All".
    const [rangeLimit, setRangeLimit] = useState<number | null>(100);

    const rangeLimitLabel = useMemo(() => {
        if (rangeLimit === null) return "All";
        return String(rangeLimit);
    }, [rangeLimit]);

    const fromIso = useMemo(
        () => (appliedRange.from ? appliedRange.from.toISOString() : null),
        [appliedRange.from],
    );
    const toIso = useMemo(
        () => (appliedRange.to ? appliedRange.to.toISOString() : null),
        [appliedRange.to],
    );
    const isRangeActive = Boolean(fromIso || toIso);

    const isDraftDifferentFromApplied = useMemo(() => {
        const dFrom = draftRange.from?.getTime?.() ?? null;
        const dTo = draftRange.to?.getTime?.() ?? null;
        const aFrom = appliedRange.from?.getTime?.() ?? null;
        const aTo = appliedRange.to?.getTime?.() ?? null;
        return dFrom !== aFrom || dTo !== aTo;
    }, [draftRange.from, draftRange.to, appliedRange.from, appliedRange.to]);

    // User role check
    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getCurrentUser()
            .then((u) => {
                if (cancelled) return;
                setCanEdit(isAdminOrSuperadmin(u));
            })
            .catch(() => {
                if (cancelled) return;
                setCanEdit(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function openEditSensorModal() {
        if (!canEdit) return;
        setSaveError(null);
        setSensorName(sensor?.name ?? "");
        editSensorModal.openModal();
    }

    function closeEditSensorModal() {
        editSensorModal.closeModal();
        setSaveError(null);
        setSensorName("");
    }

    async function onEditSensorSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canEdit) return;

        if (!id || !sensor) {
            setSaveError("Missing sensor id.");
            return;
        }

        const name = sensorName.trim();
        if (!name) {
            setSaveError("Sensor name is required.");
            return;
        }

        if (name === sensor.name) {
            closeEditSensorModal();
            return;
        }

        const branch_id = sensor.branch_id;

        setIsSaving(true);
        setSaveError(null);
        try {
            const updated = (await updateSensor(id, { name, branch_id })) as any;
            setSensor((prev) => (prev ? { ...prev, ...(updated ?? {}), name } : prev));
            closeEditSensorModal();
            notify({
                variant: "success",
                title: "Sensor updated",
                message: `Sensor renamed to “${name}”.`,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update sensor.";
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    }

    async function onDelete() {
        if (!canEdit) return;

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
        // This fetch reacts to APPLIED range only.
        let cancelled = false;

        async function run() {
            if (!id) return;

            setLoading(true);
            setError(null);
            try {
                const s = await getSensor(id);
                const res = await getSensorData(id, rangeLimit ?? undefined, fromIso, toIso);

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
    }, [id, rangeLimit, fromIso, toIso]);

    // Poll every 2 seconds for new rows and merge them into the table (latest first).
    // Pause polling while the edit modal is open to keep typing/snappiness smooth.
    // Also pause while a time-range filter is active.
    useEffect(() => {
        if (!id) return;

        const ref = pollingRef.current;

        // If the edit modal is open or a range filter is active, stop polling completely.
        if (editSensorModal.isOpen || isRangeActive) {
            ref.stop = true;
            ref.inFlight = false;
            if (ref.timer) clearTimeout(ref.timer);
            ref.timer = null;
            return;
        }

        // Stop any previous timer when the id changes.
        ref.stop = false;
        ref.inFlight = false;
        if (ref.timer) clearTimeout(ref.timer);
        ref.timer = null;

        const pollDelayMs = 2000;
        const limit = 2;

        const tick = async () => {
            if (ref.stop) return;

            // Don't overlap requests.
            if (ref.inFlight) {
                ref.timer = setTimeout(tick, pollDelayMs);
                return;
            }

            ref.inFlight = true;
            try {
                const res = await getSensorData(id, limit);
                const incoming = Array.isArray(res?.items) ? res.items : [];
                if (incoming.length > 0) {
                    setData((cur) => {
                        const currentItems = Array.isArray(cur?.items) ? (cur.items as any[]) : [];
                        const merged = new Map<string, any>();

                        // Keep existing items first (so we don't reorder unless needed)
                        for (const r of currentItems) merged.set(rowKey(r), r);
                        // Append/merge incoming (usually newest rows)
                        for (const r of incoming) merged.set(rowKey(r), r);

                        const mergedArr = Array.from(merged.values());
                        newestFirstSort(mergedArr);

                        // Cap to avoid unbounded growth.
                        const capped = mergedArr.slice(0, rangeLimit || 0);

                        const nextCount = typeof res?.count === "number" ? res.count : cur?.count ?? 0;
                        const nextSensor = res?.sensor ?? cur?.sensor ?? id;

                        return { sensor: nextSensor, count: nextCount, items: capped as any };
                    });
                } else if (typeof res?.count === "number") {
                    // keep count in sync even if no new items
                    setData((cur) => ({ ...cur, count: res.count }));
                }
            } catch {
                // Polling errors should be silent; the next tick will retry.
            } finally {
                ref.inFlight = false;
                if (!ref.stop) ref.timer = setTimeout(tick, pollDelayMs);
            }
        };

        // Start after a small delay; initial page load already fetches.
        ref.timer = setTimeout(tick, pollDelayMs);

        return () => {
            ref.stop = true;
            ref.inFlight = false;
            if (ref.timer) clearTimeout(ref.timer);
            ref.timer = null;
        };
    }, [id, editSensorModal.isOpen, isRangeActive, rangeLimit]);

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

        const preferredOrder = ["timestamp", "time", "created_at", "updated_at", "temp", "humidity"];
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
        const defaultFields = seriesWithCounts.slice(0, Math.min(2, maxSeriesDefault)).map((s) => s.series.name);

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
                        {canEdit ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={openEditSensorModal}
                                    disabled={isDeleting || isSaving}
                                >
                                    <PencilIcon/>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="ring-orange-600 bg-orange-100"
                                    onClick={onDelete}
                                    disabled={isDeleting || isSaving}
                                >
                                    <TrashBinIcon/>
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                {canEdit ? (
                    <Modal
                        isOpen={editSensorModal.isOpen}
                        onClose={closeEditSensorModal}
                        className="max-w-[700px] p-6 lg:p-10"
                    >
                        <form onSubmit={onEditSensorSubmit} className="space-y-6">
                            <div>
                                <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                                    Edit sensor
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Update this sensor’s display name.
                                </p>
                            </div>

                            <div>
                                <Label>Sensor name</Label>
                                <Input
                                    defaultValue={sensorName}
                                    onChange={(e) => setSensorName(e.target.value)}
                                    placeholder="Enter sensor name"
                                />
                            </div>

                            {saveError ? (
                                <div className="text-sm text-red-600 dark:text-red-400">{saveError}</div>
                            ) : null}

                            <div className="flex items-center justify-end gap-3">
                                <Button variant="outline" type="button" onClick={closeEditSensorModal}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Saving…" : "Save"}
                                </Button>
                            </div>
                        </form>
                    </Modal>
                ) : null}

                <ComponentCard
                    title="Time range"
                    desc={
                        isRangeActive
                            ? `Filtering ${fromIso ? "from" : ""}${fromIso && toIso ? " → " : ""}${toIso ? "to" : ""} • Rows: ${rangeLimitLabel}`
                            : `Showing latest values (live) • Rows: ${rangeLimitLabel}`
                    }
                >
                    {/* Compact layout: picker + actions on one row (wraps on small screens). */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <DateTimeRangePicker
                                id={`sensor-range-${id}`}
                                label="From / To"
                                placeholder="Select a date & time range"
                                value={draftRange}
                                disabled={loading || isRangeLoading}
                                onChangeAction={(next) => {
                                    setDraftRange(next);
                                }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <span className="whitespace-nowrap">Rows</span>
                                <select
                                    className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-theme-xs outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                    value={rangeLimit === null ? "all" : String(rangeLimit)}
                                    disabled={loading || isRangeLoading}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setRangeLimit(v === "all" ? null : Number(v));
                                    }}
                                >
                                    <option value="100">100</option>
                                    <option value="300">300</option>
                                    <option value="500">500</option>
                                    <option value="all">All</option>
                                </select>
                            </label>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                    (!isRangeActive && !draftRange.from && !draftRange.to) ||
                                    loading ||
                                    isRangeLoading
                                }
                                onClick={() => {
                                    setDraftRange({ from: null, to: null });
                                    setAppliedRange({ from: null, to: null });
                                }}
                            >
                                Clear
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loading || isRangeLoading || (!draftRange.from && !draftRange.to)}
                                onClick={async () => {
                                    if (!id) return;

                                    // Commit draft -> applied first so future effects/polling use it.
                                    setAppliedRange(draftRange);

                                    const nextFromIso = draftRange.from ? draftRange.from.toISOString() : null;
                                    const nextToIso = draftRange.to ? draftRange.to.toISOString() : null;

                                    setIsRangeLoading(true);
                                    try {
                                        const res = await getSensorData(id, rangeLimit ?? undefined, nextFromIso, nextToIso);
                                        setData({
                                            sensor: res?.sensor ?? id,
                                            count: typeof res?.count === "number" ? res.count : 0,
                                            items: Array.isArray(res?.items) ? res.items : [],
                                        });
                                    } catch (e) {
                                        const msg = e instanceof Error ? e.message : "Failed to load sensor data.";
                                        notify({ variant: "error", title: "Load failed", message: msg });
                                    } finally {
                                        setIsRangeLoading(false);
                                    }
                                }}
                            >
                                {isRangeLoading ? "Applying…" : "Apply"}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        {isDraftDifferentFromApplied ? (
                            <div className="text-xs text-orange-700 dark:text-orange-300">Changed — click Apply.</div>
                        ) : (
                            <div/>
                        )}

                        {isRangeActive ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Live polling paused while
                                filtering.</div>
                        ) : null}
                    </div>
                </ComponentCard>

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
                                            <TableRow key={rowKey(row) || row?.timestamp || row?.created_at || idx}>
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
