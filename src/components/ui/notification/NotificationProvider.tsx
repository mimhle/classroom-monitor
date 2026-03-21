"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, } from "react";

export type NotificationVariant = "success" | "error" | "warning" | "info";

export type Notification = {
    id: string;
    variant: NotificationVariant;
    title?: string;
    message: string;
    durationMs?: number;
};

type NotifyInput = Omit<Notification, "id">;

type NotificationContextValue = {
    notify: (input: NotifyInput) => void;
    dismiss: (id: string) => void;
    clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function randomId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NotificationProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [items, setItems] = useState<Notification[]>([]);
    const timeouts = useRef<Map<string, number>>(new Map());

    const dismiss = useCallback((id: string) => {
        setItems((prev) => prev.filter((n) => n.id !== id));
        const t = timeouts.current.get(id);
        if (t) {
            window.clearTimeout(t);
            timeouts.current.delete(id);
        }
    }, []);

    const clear = useCallback(() => {
        setItems([]);
        for (const t of timeouts.current.values()) window.clearTimeout(t);
        timeouts.current.clear();
    }, []);

    const notify = useCallback(
        (input: NotifyInput) => {
            const n: Notification = {
                id: randomId(),
                durationMs: 4000,
                ...input,
            };
            setItems((prev) => [n, ...prev].slice(0, 5));

            if (n.durationMs && n.durationMs > 0) {
                const t = window.setTimeout(() => dismiss(n.id), n.durationMs);
                timeouts.current.set(n.id, t);
            }
        },
        [dismiss],
    );

    const value = useMemo(
        () => ({ notify, dismiss, clear }),
        [notify, dismiss, clear],
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <div
                className="fixed right-4 top-4 z-[9999] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3"
                role="region"
                aria-label="Notifications"
            >
                {items.map((n) => (
                    <NotificationCard key={n.id} n={n} onClose={() => dismiss(n.id)}/>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error("useNotification must be used within NotificationProvider");
    }
    return ctx;
}

function NotificationCard({
    n,
    onClose,
}: {
    n: Notification;
    onClose: () => void;
}) {
    const styles: Record<NotificationVariant, { border: string; icon: string }> = {
        success: { border: "border-success-500/40", icon: "text-success-500" },
        error: { border: "border-error-500/40", icon: "text-error-500" },
        warning: { border: "border-warning-500/40", icon: "text-warning-500" },
        info: { border: "border-blue-light-500/40", icon: "text-blue-light-500" },
    };

    return (
        <div
            className={`rounded-2xl border ${styles[n.variant].border} bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark`}
            role="status"
        >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${styles[n.variant].icon}`}>{icon(n.variant)}</div>
                <div className="min-w-0 flex-1">
                    {n.title ? (
                        <div className="mb-0.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                            {n.title}
                        </div>
                    ) : null}
                    <div className="text-sm text-gray-600 dark:text-gray-300">{n.message}</div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                    aria-label="Dismiss notification"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M6 6L18 18M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}

function icon(variant: NotificationVariant) {
    switch (variant) {
        case "success":
            return (
                <svg
                    className="fill-current"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM16.7071 9.29289C17.0976 9.68342 17.0976 10.3166 16.7071 10.7071L11.7071 15.7071C11.3166 16.0976 10.6834 16.0976 10.2929 15.7071L7.29289 12.7071C6.90237 12.3166 6.90237 11.6834 7.29289 11.2929C7.68342 10.9024 8.31658 10.9024 8.70711 11.2929L11 13.5858L15.2929 9.29289C15.6834 8.90237 16.3166 8.90237 16.7071 9.29289Z"
                    />
                </svg>
            );
        case "error":
            return (
                <svg
                    className="fill-current"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 7C12.5523 7 13 7.44772 13 8V12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12V8C11 7.44772 11.4477 7 12 7ZM12 15C12.5523 15 13 15.4477 13 16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16C11 15.4477 11.4477 15 12 15Z"
                    />
                </svg>
            );
        case "warning":
            return (
                <svg
                    className="fill-current"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M1.5 20.5L12 2.5L22.5 20.5H1.5ZM13 18V16H11V18H13ZM13 14V10H11V14H13Z"
                    />
                </svg>
            );
        case "info":
            return (
                <svg
                    className="fill-current"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 10C12.5523 10 13 10.4477 13 11V17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17V11C11 10.4477 11.4477 10 12 10ZM12 6C12.5523 6 13 6.44772 13 7C13 7.55228 12.5523 8 12 8C11.4477 8 11 7.55228 11 7C11 6.44772 11.4477 6 12 6Z"
                    />
                </svg>
            );
    }
}
