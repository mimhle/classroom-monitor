"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { type Alert, getAlertsFeed, markAlertAsRead } from "@/libs/actions";
import { AlertIcon } from "@/icons";

function formatRelativeTime(iso: string) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";

    const diffMs = Date.now() - t;
    const s = Math.max(0, Math.floor(diffMs / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function badgeColor(level: Alert["level"]) {
    return level === "CRITICAL" ? "bg-red-500" : "bg-orange-400";
}

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const pollTimerRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);
    const mountedRef = useRef(false);
    const isOpenRef = useRef(false);

    // Polling speeds
    const FAST_POLL_MS = 3000;
    const SLOW_POLL_MS = 15000;

    function toggleDropdown() {
        setIsOpen(!isOpen);
    }

    function closeDropdown() {
        setIsOpen(false);
    }

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const unreadCount = useMemo(() => alerts.filter((a) => !a.is_read).length, [alerts]);
    const notifying = unreadCount > 0;

    async function fetchAlerts(opts: { signal: AbortSignal; showLoadingUI: boolean }) {
        const { signal, showLoadingUI } = opts;

        if (showLoadingUI) {
            setLoading(true);
            setError(null);
        }

        try {
            const items = await getAlertsFeed({ limit: 20, includeRead: true, signal });
            if (signal.aborted || !mountedRef.current) return;
            setAlerts(Array.isArray(items) ? items : []);
            if (showLoadingUI) setError(null);
        } catch (e) {
            if (signal.aborted || !mountedRef.current) return;
            const msg = e instanceof Error ? e.message : "Failed to load alerts.";
            // For polling errors, keep existing alerts; just surface an error.
            if (showLoadingUI) setAlerts([]);
            setError(msg);
        } finally {
            if (!signal.aborted && mountedRef.current && showLoadingUI) setLoading(false);
        }
    }

    useEffect(() => {
        mountedRef.current = true;

        const getPollMs = () => (isOpenRef.current ? FAST_POLL_MS : SLOW_POLL_MS);

        const scheduleNext = () => {
            if (!mountedRef.current) return;
            if (pollTimerRef.current != null) window.clearTimeout(pollTimerRef.current);
            pollTimerRef.current = window.setTimeout(() => tick(false), getPollMs());
        };

        const tick = (showLoadingUI: boolean) => {
            if (!mountedRef.current) return;
            if (inFlightRef.current) {
                scheduleNext();
                return;
            }

            inFlightRef.current = true;

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            fetchAlerts({ signal: controller.signal, showLoadingUI })
                .finally(() => {
                    inFlightRef.current = false;
                    if (!mountedRef.current) return;
                    scheduleNext();
                });
        };

        // Load once immediately on page/component load, then poll every 3s.
        tick(true);

        // If the user opens/closes the dropdown, adjust polling speed immediately.
        // We keep using the same polling loop; this only reschedules the next tick.
        const rescheduleOnVisibilityChange = () => scheduleNext();
        rescheduleOnVisibilityChange();

        return () => {
            mountedRef.current = false;
            if (pollTimerRef.current != null) {
                window.clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            abortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        // When open state changes, reschedule next poll with the correct interval.
        if (pollTimerRef.current != null) {
            window.clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        // If mounted, schedule an immediate refresh when opening so it feels snappy.
        if (mountedRef.current && isOpen) {
            // Fire a quick refresh without showing loading UI.
            if (!inFlightRef.current) {
                inFlightRef.current = true;
                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;
                fetchAlerts({ signal: controller.signal, showLoadingUI: false }).finally(() => {
                    inFlightRef.current = false;
                    if (!mountedRef.current) return;
                    pollTimerRef.current = window.setTimeout(() => {
                        // next tick will use fast interval (open)
                        if (!mountedRef.current) return;
                        // reuse the original loop by triggering a background refresh
                        // (we keep it simple and call fetch directly here)
                        if (inFlightRef.current) return;
                        inFlightRef.current = true;
                        abortRef.current?.abort();
                        const c = new AbortController();
                        abortRef.current = c;
                        fetchAlerts({ signal: c.signal, showLoadingUI: false }).finally(() => {
                            inFlightRef.current = false;
                        });
                    }, FAST_POLL_MS);
                });
            }
        }
    }, [isOpen]);

    const handleBellClick = () => {
        toggleDropdown();
    };

    async function onAlertClick(alert: Alert) {
        closeDropdown();
        if (alert.is_read) return;

        // Optimistic update.
        setAlerts((prev) => prev.map((a) => (a.alert_id === alert.alert_id ? { ...a, is_read: true } : a)));

        try {
            await markAlertAsRead(alert.branch_id, alert.alert_id);
        } catch {
            // Revert on failure.
            setAlerts((prev) => prev.map((a) => (a.alert_id === alert.alert_id ? { ...a, is_read: false } : a)));
        }
    }

    return (
        <div className="relative">
            <button
                className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                onClick={handleBellClick}
                aria-label="Notifications"
            >
                <span
                    className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
                        !notifying ? "hidden" : "flex"
                    }`}
                >
                    <span
                        className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
                </span>
                <AlertIcon/>
            </button>
            <Dropdown
                isOpen={isOpen}
                onClose={closeDropdown}
                className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
            >
                <div
                    className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
                    <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Notification{unreadCount ? ` (${unreadCount})` : ""}
                    </h5>
                    <button
                        onClick={toggleDropdown}
                        className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Close"
                    >
                        <svg
                            className="fill-current"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>

                <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading alerts…</li>
                    ) : error ? (
                        <li className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</li>
                    ) : alerts.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No alerts.</li>
                    ) : (
                        alerts.map((a) => {
                            const href = `/branches/${encodeURIComponent(a.branch_id)}?alert=${encodeURIComponent(a.alert_id)}`;

                            return (
                                <li key={`${a.branch_id}:${a.alert_id}`}>
                                    <DropdownItem
                                        tag={"a"}
                                        href={href}
                                        onItemClick={() => onAlertClick(a)}
                                        className="flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
                                    >
                                        <span
                                            className="flex h-10 w-4 items-center justify-center rounded-full bg-transparent">
                                            <span className={`h-2.5 w-2.5 rounded-full ${badgeColor(a.level)}`}/>
                                        </span>

                                        <span className="block min-w-0">
                                            <span className="mb-1 block text-theme-sm text-gray-800 dark:text-white/90">
                                                <div
                                                    className={`block truncate ${a.is_read ? "opacity-70" : "font-medium"}`}
                                                >
                                                    {a.message}
                                                </div>
                                            </span>

                                            <span
                                                className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                                                <span>{a.level}</span>
                                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>{formatRelativeTime(a.created_at)}</span>
                                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span className="font-mono">{a.branch_id}</span>
                                            </span>
                                        </span>
                                    </DropdownItem>
                                </li>
                            );
                        })
                    )}
                </ul>
            </Dropdown>
        </div>
    );
}
