"use server";

const USERS = [
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
    }
];

const PASSWORDS = [
    {
        username: "johndoe",
        password: "admin",
    },
    {
        username: "janesmith",
        password: "admin",
    }
];

const NODES = [
    {
        id: "1",
        name: "Node 1",
        type: "Type A",
    },
    {
        id: "2",
        name: "Node 2",
        type: "Type B",
    }
];

export async function getUserByUsername(username: string) {
    return USERS.find(user => user.username === username);
}


export async function authenticateUser(username: string, password: string) {
    const user = PASSWORDS.find(
        user => user.username === username && user.password === password
    );
    return user ? getUserByUsername(username) : null;
}


export async function getUser(userId: string) {
    return USERS.find(user => user.id === userId);
}