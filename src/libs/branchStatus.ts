import Badge from "@/components/ui/badge/Badge";

export type AlertBadge = {
    label: string;
    color: React.ComponentProps<typeof Badge>["color"];
    variant: React.ComponentProps<typeof Badge>["variant"];
    title?: string;
};

/**
 * Convert the backend's unknown `alert` payload into a stable UI badge.
 *
 * This is shared by pages that need a consistent branch-status rendering.
 */
export function deriveAlertBadge(alert: unknown): AlertBadge {
    // Treat empty values as no alerts.
    if (
        alert == null ||
        alert === false ||
        alert === 0 ||
        alert === "" ||
        (Array.isArray(alert) && alert.length === 0)
    ) {
        return { label: "None", color: "light", variant: "light", title: "No alerts" };
    }

    if (typeof alert === "number") {
        if (alert <= 0) {
            return { label: "None", color: "light", variant: "light", title: "No alerts" };
        }
        const label = `${alert} alert${alert === 1 ? "" : "s"}`;
        return { label, color: "warning", variant: "solid", title: label };
    }

    if (typeof alert === "boolean") {
        return {
            label: alert ? "Active" : "None",
            color: alert ? "warning" : "light",
            variant: alert ? "solid" : "light",
            title: alert ? "Alerts active" : "No alerts",
        };
    }

    if (Array.isArray(alert)) {
        const n = alert.length;
        if (n === 0) {
            return { label: "None", color: "light", variant: "light", title: "No alerts" };
        }
        const label = `${n} alert${n === 1 ? "" : "s"}`;
        return { label, color: "warning", variant: "solid", title: label };
    }

    if (typeof alert === "object") {
        const obj = alert as Record<string, unknown>;

        // Common shapes: {count: number}, {alerts: []}, {items: []}
        const count =
            typeof obj.count === "number"
                ? obj.count
                : typeof obj.total === "number"
                    ? obj.total
                    : undefined;

        const arrLike =
            Array.isArray(obj.alerts)
                ? obj.alerts.length
                : Array.isArray(obj.items)
                    ? obj.items.length
                    : Array.isArray(obj.data)
                        ? obj.data.length
                        : undefined;

        const n = count ?? arrLike;
        if (typeof n === "number") {
            if (n <= 0) {
                return { label: "None", color: "light", variant: "light", title: "No alerts" };
            }
            const label = `${n} alert${n === 1 ? "" : "s"}`;
            return { label, color: "warning", variant: "solid", title: label };
        }

        // Empty object -> none.
        if (Object.keys(obj).length === 0) {
            return { label: "None", color: "light", variant: "light", title: "No alerts" };
        }

        // Anything else truthy object: treat as active.
        let title: string | undefined;
        try {
            title = JSON.stringify(alert);
            if (title && title.length > 140) title = title.slice(0, 140) + "…";
        } catch {
            // ignore
        }
        return { label: "Active", color: "warning", variant: "solid", title };
    }

    // Fallback: truthy string/primitive.
    return { label: "Active", color: "warning", variant: "solid" };
}
