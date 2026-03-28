"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

function normalize(values: Array<number | null | undefined> | undefined): number[] {
    if (!Array.isArray(values)) return [];
    return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

export default function PredictionSparkline({
    values,
    color = "#465FFF",
    width = 72,
    height = 22,
    decimals = 0,
}: {
    values: Array<number | null | undefined> | undefined;
    color?: string;
    width?: number;
    height?: number;
    decimals?: number;
}) {
    const data = useMemo(() => normalize(values), [values]);

    const series = useMemo(() => [{ name: "prediction", data }], [data]);

    const options: ApexOptions = useMemo(
        () => ({
            chart: {
                type: "line",
                sparkline: { enabled: true },
                animations: { enabled: false },
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            stroke: {
                curve: "smooth",
                width: 2,
            },
            colors: [color],
            grid: { show: false },
            tooltip: { enabled: false },
            dataLabels: { enabled: false },
            markers: { size: 0 },
            xaxis: {
                labels: { show: false },
                axisBorder: { show: false },
                axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: {
                show: false,
            },
        }),
        [color],
    );

    const fmt = (v: number | undefined) => {
        if (typeof v !== "number" || !Number.isFinite(v)) return "";
        return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
    };

    const start = data[0];
    const end = data.length ? data[data.length - 1] : undefined;

    // Wrapper is intentionally tiny, so we keep labels minimal.
    return (
        <div className="flex items-center gap-1" aria-label="Prediction trend">
            <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400 tabular-nums">
                {fmt(start)}
            </span>

            {data.length < 2 ? (
                <div
                    aria-hidden
                    className="rounded bg-gray-100 dark:bg-gray-800"
                    style={{ width, height }}
                />
            ) : (
                <ReactApexChart
                    options={options}
                    series={series}
                    type="line"
                    width={width}
                    height={height}
                />
            )}

            <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400 tabular-nums">
                {fmt(end)}
            </span>
        </div>
    );
}
