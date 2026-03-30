"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { useNotification } from "@/components/ui/notification";
import { getLogs, type Log } from "@/libs/actions";

type ParsedLog = {
    raw: string;
    at: Date | null;
    type: string;
    message: string;
};

function tryParseEmbeddedJsonMessage(message: string): string {
    const trimmed = message.trim();

    // Some entries look like: "{\"username\": ...}" (a JSON string literal)
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || trimmed.includes("\\\"")) {
        try {
            const s = JSON.parse(trimmed);
            if (typeof s === "string") {
                try {
                    const obj = JSON.parse(s);
                    return typeof obj === "object" && obj ? JSON.stringify(obj, null, 2) : s;
                } catch {
                    return s;
                }
            }
        } catch {
            // ignore
        }
    }

    // Sometimes message itself is JSON.
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
            const obj = JSON.parse(trimmed);
            return JSON.stringify(obj, null, 2);
        } catch {
            // ignore
        }
    }

    return message;
}

function parseLogLine(line: string): ParsedLog {
    // Expected format:
    // 2026-03-30T06:50:14.414709+00:00 | LOGIN | User 'admin' logged in
    // Keep it resilient if backend changes formatting.
    const parts = line.split(" | ");
    const ts = parts[0] ?? "";
    const type = parts[1] ?? "";
    const message = parts.slice(2).join(" | ") ?? "";

    const d = new Date(ts);
    const at = Number.isFinite(d.getTime()) ? d : null;

    return {
        raw: line,
        at,
        type: type.trim(),
        message: tryParseEmbeddedJsonMessage(message),
    };
}

export default function LogsAdmin() {
    const { notify } = useNotification();

    const [items, setItems] = useState<Log[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");

    const parsed = useMemo(() => items.map(parseLogLine), [items]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return parsed;

        return parsed.filter((p) => {
            return (
                p.raw.toLowerCase().includes(q) ||
                p.message.toLowerCase().includes(q) ||
                p.type.toLowerCase().includes(q)
            );
        });
    }, [parsed, query]);

    const bigText = useMemo(() => {
        // Show the original raw line so it matches backend output exactly.
        // (We still parse for search robustness.)
        return visible.map((p) => p.raw).join("\n");
    }, [visible]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getLogs();
            const c = typeof (res as any)?.count === "number" ? (res as any).count : 0;
            const data = Array.isArray((res as any)?.items) ? ((res as any).items as Log[]) : [];
            setCount(c);
            setItems(data);
        } catch (e: any) {
            const message = e?.message ?? "Failed to load logs";
            setError(message);
            notify({ variant: "error", title: "Failed to load logs", message });
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Logs</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {loading ? "Loading…" : `${visible.length} shown`} {count ? `(total: ${count})` : ""}
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="w-full sm:w-96">
                        <Input
                            placeholder="Search logs…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <Button variant="outline" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <textarea
                    className="h-[65vh] w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-100"
                    readOnly
                    value={loading ? "Loading…" : visible.length === 0 ? "No logs found." : bigText}
                />
            </div>
        </div>
    );
}
