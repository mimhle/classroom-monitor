"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeRole } from "@/libs/roles";

export type CurrentUser = {
    user_id: string;
    group_id: string;
    username: string;
    role: string;
    [key: string]: any;
} | null;

export async function getHostUrl() {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = "http";
    return `${protocol}://${host}`;
}

export async function checkAuth() {
    const res = await fetch(`${await getHostUrl()}/api/auth/validate`, {
        method: "GET",
        cache: "no-store",
        headers: {
            cookie: (await cookies()).toString(),
        },
    }).catch(e => {
        throw e;
    });
    return res.ok;
}

export async function signIn(username: string, password: string) {
    const res = await fetch(`${await getHostUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
    });
    return res.ok;
}

export async function signOut() {
    const res = await fetch(`${await getHostUrl()}/api/auth/logout`, {
        method: "POST",
        cache: "no-store",
        headers: {
            cookie: (await cookies()).toString(),
        },
    });
    return res.ok;
}

export async function getCurrentUser(): Promise<CurrentUser> {
    const authenticated = await checkAuth();
    if (!authenticated) return null;

    const res = await fetch(`${await getHostUrl()}/api/user`, {
        method: "GET",
        cache: "no-store",
        headers: {
            cookie: (await cookies()).toString(),
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch user info: ${res.statusText}`);
    }

    return res.json().then(r => {
        return r.data;
    });
}

export async function requireAuth(opts?: { redirectTo?: string }) {
    const user = await getCurrentUser();
    if (!user) {
        redirect(opts?.redirectTo ?? "/signin");
    }
    return user;
}

export async function requireRole(role: string | string[], opts?: { redirectTo?: string }) {
    const user = await requireAuth(opts);

    console.log("requireRole: user role is", user);

    const allowed = Array.isArray(role) ? role : [role];
    const userRole = normalizeRole((user as any)?.role);

    const ok = allowed.map((r) => normalizeRole(r)).includes(userRole);
    if (!ok) {
        // Keep behavior simple: bounce non-admins away.
        redirect(opts?.redirectTo ?? "/");
    }

    return user;
}
