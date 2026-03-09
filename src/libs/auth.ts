"use server";

import { cookies } from 'next/headers';

export async function checkAuth(token: string) {
    return !!token; // Return true if token exists, false otherwise
}

export async function signIn(username: string, password: string) {
    if (username === "admin" && password === "admin") {
        (await cookies()).set("token", "your-auth-token");
        return true;
    }
    return false;
}

export async function signOut() {
    (await cookies()).delete("token");
    return true;
}