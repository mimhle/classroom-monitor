"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { createUser, deleteUser, getUsers } from "@/libs/actions";
import { useNotification } from "@/components/ui/notification";

type User = {
    user_id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    username: string;
    groupId?: string;
    role: string;
};

export default function UsersAdmin() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { notify } = useNotification();

    const createModal = useModal(false);
    const [newUser, setNewUser] = useState({
        username: "",
        role: "User",
    });
    const [creating, setCreating] = useState(false);

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.username.localeCompare(b.username));
    }, [users]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getUsers();
            // actions.getUsers() currently returns the raw JSON; normalize a bit.
            setUsers((data?.data ?? data?.users ?? []) as User[]);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username.trim()) {
            setError("Username is required");
            return;
        }
        setCreating(true);
        setError(null);
        try {
            await createUser(newUser as any);
            createModal.closeModal();
            setNewUser({ username: "", role: "User" });
            notify({ variant: "success", title: "User created", message: "User was created successfully." });
            await load();
        } catch (e: any) {
            setError(e?.message ?? "Failed to create user");
        } finally {
            setCreating(false);
        }
    }, [createModal, load, newUser, notify]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm("Delete this user?")) return;
        setError(null);
        try {
            await deleteUser(id);
            notify({ variant: "success", title: "User deleted", message: "User was deleted successfully." });
            await load();
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete user");
        }
    }, [load, notify]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Admin-only: create and manage users.</p>
                </div>
                <Button onClick={createModal.openModal}>New user</Button>
            </div>

            {error && (
                <div
                    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Username</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Role</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {sortedUsers.map((u) => (
                            <tr key={u.user_id} className="bg-white dark:bg-gray-900">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{u.username}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{u.role}</td>
                                <td className="px-4 py-3 text-right">
                                    <Button size="sm" variant="outline"
                                            onClick={() => handleDelete(u.user_id)}>Delete</Button>
                                </td>
                            </tr>
                        ))}
                        {sortedUsers.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={5}>No users
                                    found.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[640px] p-5 lg:p-8">
                <form onSubmit={handleCreate} className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">Create user</h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" name="username" type="text" defaultValue={newUser.username}
                                   onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}/>
                        </div>
                        <div>
                            <Label htmlFor="role">Role</Label>
                            <select
                                id="role"
                                name="role"
                                value={newUser.role}
                                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            >
                                <option value="User">User</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password"
                                   onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}/>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Button size="sm" variant="outline" onClick={createModal.closeModal}
                                disabled={creating}>Cancel</Button>
                        <Button size="sm" type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
