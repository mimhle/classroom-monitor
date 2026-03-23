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

export type CreateBranchInput = {
    name: string;
    group_id?: string;
};

export async function createBranch(input: CreateBranchInput) {
    return fetch(`/api/branches`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json();
    });
}

export async function getBranch(id: string) {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}


export async function deleteBranch(id: string) {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export async function updateBranch(id: string, input: CreateBranchInput) {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getUsers() {
    return fetch(`/api/users`, {
        method: "GET",
        cache: "no-store",
    }).then((res) => {
        if (!res.ok) {
            throw new Error(`Failed to fetch users: ${res.statusText}`);
        }
        return res.json();
    });
}

export async function getUser(id: string) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type CreateUserInput = {
    username: string;
    password?: string;
    role?: "User" | "Admin";
};

export async function createUser(input: CreateUserInput) {
    return fetch(`/api/users`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function deleteUser(id: string) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export async function updateUser(id: string, input: CreateUserInput) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update user: ${res.status
                } ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}
