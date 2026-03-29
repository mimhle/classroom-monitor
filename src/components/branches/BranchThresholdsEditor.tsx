"use client";

import React, { useMemo } from "react";
import type { SensorField, SensorThresholds } from "@/libs/actions";
import Switch from "@/components/form/switch/Switch";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";

export type BranchThresholds = {
    activate: boolean;
    sensors: Record<SensorField, SensorThresholds>;
};

const SENSOR_FIELDS: SensorField[] = [
    "co2",
    "temp",
    "rh",
    "vbat",
    "lux",
    "mic",
    "pm2_5",
    "pm10",
];

function defaultsFor(field: SensorField): SensorThresholds {
    // Safe(ish) generic defaults. User can tune them.
    switch (field) {
        case "co2":
            return { min: 400, max: 1000, activated: true };
        case "temp":
            return { min: 18, max: 27, activated: true };
        case "rh":
            return { min: 30, max: 70, activated: true };
        case "vbat":
            return { min: 3.0, max: 4.2, activated: false };
        case "lux":
            return { min: 0, max: 2000, activated: false };
        case "mic":
            return { min: 0, max: 1, activated: false };
        case "pm2_5":
            return { min: 0, max: 35, activated: false };
        case "pm10":
            return { min: 0, max: 50, activated: false };
        default:
            return { min: 0, max: 0, activated: false };
    }
}

function sensorMeta(field: SensorField): { label: string; unit?: string } {
    switch (field) {
        case "co2":
            return { label: "CO₂", unit: "ppm" };
        case "temp":
            return { label: "Temperature", unit: "°C" };
        case "rh":
            return { label: "Relative humidity", unit: "%" };
        case "vbat":
            return { label: "Battery", unit: "V" };
        case "lux":
            return { label: "Light", unit: "lux" };
        case "mic":
            return { label: "Microphone", unit: "(a.u.)" };
        case "pm2_5":
            return { label: "PM2.5", unit: "µg/m³" };
        case "pm10":
            return { label: "PM10", unit: "µg/m³" };
        default:
            return { label: field };
    }
}

function coerceNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

function sensorShortLabel(field: SensorField): string {
    switch (field) {
        case "co2":
            return "CO₂";
        case "temp":
            return "Temp";
        case "rh":
            return "RH";
        case "vbat":
            return "Bat";
        case "lux":
            return "Lux";
        case "mic":
            return "Mic";
        case "pm2_5":
            return "PM2.5";
        case "pm10":
            return "PM10";
        default:
            return field;
    }
}

type ThresholdsSummary = {
    enabled: boolean;
    activeSensors: number;
    invalidRows: number;
    preview: Array<{ field: SensorField; min: number; max: number }>;
};

function thresholdsSummary(value: BranchThresholds): ThresholdsSummary {
    let activeSensors = 0;
    let invalidRows = 0;
    const preview: Array<{ field: SensorField; min: number; max: number }> = [];

    for (const f of SENSOR_FIELDS) {
        const t = value?.sensors?.[f];
        if (!t || !t.activated) continue;
        activeSensors += 1;

        if (!Number.isFinite(t.min) || !Number.isFinite(t.max) || t.min > t.max) invalidRows += 1;
        if (preview.length < 4) preview.push({ field: f, min: t.min, max: t.max });
    }

    return {
        enabled: Boolean(value?.activate),
        activeSensors,
        invalidRows,
        preview,
    };
}

export default function BranchThresholdsEditor(props: {
    value: BranchThresholds;
    disabled?: boolean;
    onChangeAction: (next: BranchThresholds) => void;
    actions?: React.ReactNode;
}) {
    const value = props.value;
    const disabled = Boolean(props.disabled);

    const normalized = useMemo<BranchThresholds>(() => {
        const sensors = { ...(value?.sensors ?? ({} as any)) } as Record<SensorField, SensorThresholds>;
        for (const f of SENSOR_FIELDS) {
            if (!sensors[f]) sensors[f] = defaultsFor(f);
        }
        return {
            activate: Boolean(value?.activate),
            sensors,
        };
    }, [value]);

    const errors = useMemo(() => {
        const rowErrors: Partial<Record<SensorField, string>> = {};
        for (const f of SENSOR_FIELDS) {
            const t = normalized.sensors[f];
            if (!t) continue;
            if (!Number.isFinite(t.min) || !Number.isFinite(t.max)) {
                rowErrors[f] = "Min/max must be numbers.";
                continue;
            }
            if (t.min > t.max) {
                rowErrors[f] = "Min must be ≤ max.";
            }
        }
        return rowErrors;
    }, [normalized]);

    const hasErrors = Object.keys(errors).length > 0;

    const summary = useMemo(() => thresholdsSummary(normalized), [normalized]);

    return (
        <details
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs open:p-4 dark:border-gray-800 dark:bg-gray-900"
            open={false}
        >
            <summary className="cursor-pointer list-none select-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                                Thresholds
                            </span>
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                    summary.enabled
                                        ? "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/30 dark:text-green-200 dark:ring-green-900/40"
                                        : "bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:ring-gray-800"
                                }`}
                            >
                                {summary.enabled ? "Enabled" : "Disabled"}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {summary.activeSensors} active
                            </span>
                            {summary.invalidRows ? (
                                <span className="text-[11px] text-red-600 dark:text-red-300">
                                    {summary.invalidRows} invalid
                                </span>
                            ) : null}
                        </div>

                        {summary.preview.length ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {summary.preview.map((p) => (
                                    <span
                                        key={p.field}
                                        className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-900/40 dark:text-gray-200 dark:ring-gray-800"
                                        title={p.field}
                                    >
                                        <span className="font-medium">{sensorShortLabel(p.field)}</span>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {p.min}–{p.max}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                No active sensor thresholds.
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                        Click to {"expand"}
                    </div>
                </div>
            </summary>

            <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-1">
                    <Switch
                        label="Activate thresholds"
                        defaultChecked={normalized.activate}
                        disabled={disabled}
                        onChange={(checked) => {
                            props.onChangeAction({
                                ...normalized,
                                activate: checked,
                            });
                        }}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        When deactivated, alerts based on thresholds should be suppressed.
                    </p>
                </div>

                {hasErrors ? (
                    <div
                        className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        Fix threshold values before saving.
                    </div>
                ) : null}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-1">
                        <thead>
                        <tr className="text-left text-[11px] text-gray-500 dark:text-gray-400">
                            <th className="px-2">Sensor</th>
                            <th className="px-2">Active</th>
                            <th className="px-2">Min</th>
                            <th className="px-2">Max</th>
                        </tr>
                        </thead>
                        <tbody>
                        {SENSOR_FIELDS.map((field) => {
                            const t = normalized.sensors[field];
                            const meta = sensorMeta(field);
                            const rowDisabled = disabled || !normalized.activate;

                            return (
                                <tr
                                    key={field}
                                    className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                                >
                                    <td className="px-2 py-2 align-top">
                                        <div className="text-xs font-semibold text-gray-800 dark:text-white/90">
                                            {meta.label}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {field}
                                            {meta.unit ? ` · ${meta.unit}` : ""}
                                        </div>
                                        {errors[field] ? (
                                            <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-300">
                                                {errors[field]}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                        <Switch
                                            label={t?.activated ? "On" : "Off"}
                                            defaultChecked={Boolean(t?.activated)}
                                            disabled={rowDisabled}
                                            color="gray"
                                            onChange={(checked) => {
                                                props.onChangeAction({
                                                    ...normalized,
                                                    sensors: {
                                                        ...normalized.sensors,
                                                        [field]: { ...t, activated: checked },
                                                    },
                                                });
                                            }}
                                        />
                                    </td>
                                    <td className="px-2 py-2 align-top min-w-[140px]">
                                        <Label htmlFor={`th-${field}-min`} className="sr-only">
                                            {meta.label} min
                                        </Label>
                                        <Input
                                            id={`th-${field}-min`}
                                            type="number"
                                            value={String(t?.min ?? "")}
                                            disabled={rowDisabled || !t?.activated}
                                            onChange={(e) => {
                                                const n = coerceNumber(e.target.value);
                                                props.onChangeAction({
                                                    ...normalized,
                                                    sensors: {
                                                        ...normalized.sensors,
                                                        [field]: {
                                                            ...t,
                                                            min: n ?? t.min,
                                                        },
                                                    },
                                                });
                                            }}
                                        />
                                    </td>
                                    <td className="px-2 py-2 align-top min-w-[140px]">
                                        <Label htmlFor={`th-${field}-max`} className="sr-only">
                                            {meta.label} max
                                        </Label>
                                        <Input
                                            id={`th-${field}-max`}
                                            type="number"
                                            value={String(t?.max ?? "")}
                                            disabled={rowDisabled || !t?.activated}
                                            onChange={(e) => {
                                                const n = coerceNumber(e.target.value);
                                                props.onChangeAction({
                                                    ...normalized,
                                                    sensors: {
                                                        ...normalized.sensors,
                                                        [field]: {
                                                            ...t,
                                                            max: n ?? t.max,
                                                        },
                                                    },
                                                });
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                {props.actions ? <div className="pt-3">{props.actions}</div> : null}
            </div>
        </details>
    );
}
