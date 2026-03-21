"use client";

export async function getBranches() {
    return fetch(`/api/branches`, {
        method: "GET",
        cache: "no-store",
    }).then((res) => {
        if (!res.ok) {
            throw new Error(`Failed to fetch branches: ${res.statusText}`);
        }
        return res.json();
    });
}