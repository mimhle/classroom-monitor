"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";

import Label from "./Label";
import { CalenderIcon } from "../../icons";

export type DateTimeRange = {
    from: Date | null;
    to: Date | null;
};

type Props = {
    id: string;
    label?: string;
    placeholder?: string;
    value?: DateTimeRange;
    onChangeAction?: (next: DateTimeRange) => void;
    disabled?: boolean;
};

/**
 * TailAdmin-style flatpickr range picker with time enabled.
 *
 * UX note: flatpickr fires `onChange` multiple times while the user is still
 * adjusting the time. Parent components that want to avoid expensive reloads
 * should keep a draft value and apply it explicitly (with a button).
 */
export default function DateTimeRangePicker({
    id,
    label,
    placeholder,
    value,
    onChangeAction,
    disabled,
}: Props) {
    const fpRef = useRef<flatpickr.Instance | null>(null);
    const lastEmittedRef = useRef<DateTimeRange>({ from: null, to: null });

    const emitIfChanged = (next: DateTimeRange) => {
        const prev = lastEmittedRef.current;
        const fromSame = (prev.from?.getTime?.() ?? null) === (next.from?.getTime?.() ?? null);
        const toSame = (prev.to?.getTime?.() ?? null) === (next.to?.getTime?.() ?? null);
        if (fromSame && toSame) return;
        lastEmittedRef.current = next;
        onChangeAction?.(next);
    };

    useEffect(() => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) return;

        // Initialize last emitted value.
        lastEmittedRef.current = { from: value?.from ?? null, to: value?.to ?? null };

        const fp = flatpickr(el, {
            mode: "range",
            static: true,
            monthSelectorType: "static",
            enableTime: true,
            time_24hr: true,
            // Keep it readable + unambiguous.
            dateFormat: "Y-m-d H:i",
            defaultDate:
                value?.from && value?.to
                    ? [value.from, value.to]
                    : value?.from
                        ? [value.from]
                        : undefined,
            onChange: (selectedDates) => {
                const from = selectedDates?.[0] ?? null;
                const to = selectedDates?.[1] ?? null;

                // Always emit; parent can decide when to apply.
                emitIfChanged({ from, to });
            },
        });

        fpRef.current = Array.isArray(fp) ? null : fp;

        return () => {
            if (fpRef.current) fpRef.current.destroy();
            fpRef.current = null;
        };
        // Intentionally create once per id.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Keep flatpickr in sync when external value changes (e.g., loading persisted range).
    useEffect(() => {
        const inst = fpRef.current;
        if (!inst) return;

        lastEmittedRef.current = { from: value?.from ?? null, to: value?.to ?? null };

        if (value?.from && value?.to) {
            inst.setDate([value.from, value.to], false);
        } else if (value?.from) {
            inst.setDate([value.from], false);
        } else {
            inst.clear();
        }
    }, [value?.from, value?.to]);

    return (
        <div>
            {label ? <Label htmlFor={id}>{label}</Label> : null}

            <div className="relative">
                <input
                    id={id}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800 disabled:opacity-60"
                />

                <span
                    className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                    <CalenderIcon className="size-6"/>
                </span>
            </div>
        </div>
    );
}
