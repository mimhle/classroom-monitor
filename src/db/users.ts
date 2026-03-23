"use server";

// In-memory user store for the dashboard demo.
// If you already have a real backend for users, replace these functions with proxy calls.

type User = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    username: string;
    groupId?: string;
    role: string;
};

let USERS: User[] = [
    {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "randomuser@pimjo.com",
        phone: "+09 363 398 46",
        username: "johndoe",
        groupId: "1",
        role: "Admin",
    },
    {
        id: "2",
        firstName: "Jane",
        lastName: "Smith",
        email: "janesmith@gmail.com",
        phone: "+09 363 398 47",
        username: "janesmith",
        groupId: "2",
        role: "User",
    },
];

function nextId() {
    const max = USERS.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0);
    return String(max + 1);
}

export async function listUsers(): Promise<User[]> {
    return USERS;
}

export async function createUser(input: Omit<User, "id"> & { id?: string }): Promise<User> {
    const username = input.username.trim();
    if (!username) throw new Error("username is required");
    if (USERS.some((u) => u.username === username)) throw new Error("username already exists");

    const user: User = {
        id: input.id ?? nextId(),
        username,
        role: input.role ?? "User",
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        groupId: input.groupId,
    };
    USERS = [...USERS, user];
    return user;
}

export async function deleteUser(id: string): Promise<boolean> {
    const before = USERS.length;
    USERS = USERS.filter((u) => u.id !== id);
    return USERS.length !== before;
}
