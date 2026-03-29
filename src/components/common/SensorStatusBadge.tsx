import Badge from "@/components/ui/badge/Badge";

export type SensorStatus = "online" | "offline";

export default function SensorStatusBadge({
    status,
    size = "sm",
}: {
    status: SensorStatus | string | null | undefined;
    size?: "sm" | "md";
}) {
    const s = typeof status === "string" ? status.toLowerCase() : "";

    const normalized: SensorStatus | "unknown" =
        s === "online" ? "online" : s === "offline" ? "offline" : "unknown";

    const color = normalized === "online" ? "success" : normalized === "offline" ? "error" : "light";
    const label = normalized === "unknown" ? "Unknown" : normalized === "online" ? "Online" : "Offline";

    return (
        <Badge color={color} variant="light" size={size}>
            {label}
        </Badge>
    );
}
