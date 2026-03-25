"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type SensorFieldsLineChartSeries = {
    name: string;
    data: Array<{ x: number; y: number | null }>;
};

export default function SensorFieldsLineChart({
    series,
    height = 320,
}: {
    series: SensorFieldsLineChartSeries[];
    height?: number;
}) {
    const options: ApexOptions = {
        legend: {
            show: true,
            position: "top",
            horizontalAlign: "left",
        },
        chart: {
            fontFamily: "Outfit, sans-serif",
            type: "line",
            height,
            toolbar: { show: false },
            zoom: { enabled: false },
        },
        colors: [
            "#465FFF",
            "#9CB9FF",
            "#22C55E",
            "#F97316",
            "#A855F7",
            "#EF4444",
            "#14B8A6",
            "#EAB308",
            "#94A3B8",
            "#0EA5E9",
        ],
        stroke: {
            curve: "straight",
            width: 2,
        },
        markers: {
            size: 0,
            hover: { size: 5 },
        },
        dataLabels: { enabled: false },
        grid: {
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        xaxis: {
            type: "datetime",
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        // Give each field its own axis so a very large value doesn't flatten other lines.
        yaxis: series.map((s, idx) => ({
            seriesName: s.name,
            opposite: idx % 2 === 1,
            title: {
                text: s.name,
                style: {
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "#6B7280",
                },
            },
            labels: {
                style: {
                    fontSize: "12px",
                    colors: ["#6B7280"],
                },
            },
            axisBorder: {
                show: true,
                color: "#E5E7EB",
            },
            axisTicks: {
                show: true,
                color: "#E5E7EB",
            },
            tooltip: {
                enabled: true,
            },
        })),
        tooltip: {
            enabled: true,
            x: { format: "dd/MM/yyyy HH:mm:ss" },
        },
    };

    // Attach each series to its own axis.
    const chartSeries = series.map((s, idx) => ({
        ...s,
        yAxisIndex: idx,
    }));

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <div className="">
                <ReactApexChart options={options} series={chartSeries} type="line" height={height}/>
            </div>
        </div>
    );
}
