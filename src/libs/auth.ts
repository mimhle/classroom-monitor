"use server";

import { cookies, headers } from "next/headers";

async function getHostUrl() {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = host?.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
}

export async function checkAuth() {
    try {
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
    } catch {
        return false;
    }
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

export async function getCurrentUser() {
    // For iots-backend, the session stores a 'user' value server-side; there's no /me endpoint.
    // We decode nothing from the cookie. Instead, we return a minimal placeholder user if authenticated.
    const authenticated = await checkAuth();
    if (!authenticated) return null;

    // If you later add /api/auth/me on the backend, swap this for that.
    return {
        firstName: "User",
        lastName: "",
        email: "",
        role: "",
        username: "",
    };
}