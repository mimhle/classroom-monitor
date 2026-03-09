"use server";

import { cookies } from "next/headers";
import { authenticateUser, getUserByUsername } from "@/db/testdb";

export async function checkAuth(token: string) {
    return !!token; // Return true if token exists, false otherwise
}

export async function signIn(username: string, password: string) {
    if (await authenticateUser(username, password)) {
        (await cookies()).set("token", username);
        return true;
    }
    return false;
}

export async function signOut() {
    (await cookies()).delete("token");
    return true;
}

export async function getCurrentUser() {
    const token = (await cookies()).get("token")?.value;
    if (token) {
        // Mock user data
        return getUserByUsername(token);
    }
    return null;
}