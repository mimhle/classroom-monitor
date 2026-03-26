export type AnyUserLike = { role?: unknown } | null | undefined;

export type NormalizedRole = "admin" | "superadmin" | "user" | string;

export function normalizeRole(role: unknown): NormalizedRole {
    if (typeof role !== "string") return "";
    return role.trim().toLowerCase();
}

export function isSuperadmin(user: AnyUserLike): boolean {
    return normalizeRole((user as any)?.role) === "superadmin";
}

export function isAdminOrSuperadmin(user: AnyUserLike): boolean {
    const role = normalizeRole((user as any)?.role);
    return role === "admin" || role === "superadmin";
}
