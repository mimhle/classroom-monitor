"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { createUser, deleteUser, getUsers, updateUser } from "@/libs/actions";
import { useNotification } from "@/components/ui/notification";
import { type CurrentUser, getCurrentUser } from "@/libs/auth";
import { isSuperadmin } from "@/libs/roles";

type User = {
    user_id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    username: string;
    group_id?: string;
    role: string;
};

function asStringOrEmpty(v: unknown): string {
    if (typeof v === "string") return v;
    if (v == null) return "";
    // Handles numbers/booleans gracefully; avoids crashing on objects.
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return "";
}

export default function UsersAdmin() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const { notify } = useNotification();

    const [me, setMe] = useState<CurrentUser>(null);

    const createModal = useModal(false);
    const [newUser, setNewUser] = useState<{ username: string; role: string; password?: string; group_id?: string }>({
        username: "",
        role: "User",
        password: "",
        group_id: "",
    });
    const [creating, setCreating] = useState(false);

    const editModal = useModal(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editDraft, setEditDraft] = useState<{
        username: string;
        role: string;
        password?: string;
        group_id?: string
    }>({
        username: "",
        role: "User",
        password: "",
        group_id: "",
    });
    const [updating, setUpdating] = useState(false);

    const isMeSuperadmin = useMemo(() => isSuperadmin(me), [me]);

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.username.localeCompare(b.username));
    }, [users]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getUsers();
            // actions.getUsers() currently returns the raw JSON; normalize a bit.
            const raw = (data?.data ?? data?.users ?? []) as any[];
            const normalized: User[] = Array.isArray(raw)
                ? raw.map((u: any) => ({
                    ...u,
                    username: asStringOrEmpty(u?.username),
                    role: asStringOrEmpty(u?.role),
                    group_id: asStringOrEmpty(u?.group_id) || undefined,
                }))
                : [];
            setUsers(normalized);
        } catch (e: any) {
            const message = e?.message ?? "Failed to load users";
            setError(message);
            notify({ variant: "error", title: "Failed to load users", message });
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        getCurrentUser()
            .then((u) => setMe(u))
            .catch((e) => console.error("Failed to fetch current user:", e));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!newUser.username.trim()) {
                const message = "Username is required";
                setError(message);
                notify({ variant: "error", title: "Validation error", message });
                return;
            }
            setCreating(true);
            setError(null);
            try {
                const groupId = asStringOrEmpty(newUser.group_id).trim();
                const payload = {
                    username: newUser.username,
                    role: newUser.role as any,
                    password: newUser.password,
                    ...(isMeSuperadmin && groupId ? { group_id: groupId } : {}),
                };

                await createUser(payload as any);
                createModal.closeModal();
                setNewUser({ username: "", role: "User", password: "", group_id: "" });
                notify({ variant: "success", title: "User created", message: "User was created successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to create user";
                setError(message);
                notify({ variant: "error", title: "Failed to create user", message });
            } finally {
                setCreating(false);
            }
        },
        [createModal, isMeSuperadmin, load, newUser.group_id, newUser.password, newUser.role, newUser.username, notify],
    );

    const openEdit = useCallback(
        (u: User) => {
            setEditingUser(u);
            setEditDraft({
                username: u.username ?? "",
                role: u.role ?? "User",
                // password is intentionally blank; only update if user types one
                password: "",
                group_id: asStringOrEmpty((u as any).group_id),
            });
            editModal.openModal();
        },
        [editModal],
    );

    const handleUpdate = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!editingUser) return;

            if (!editDraft.username.trim()) {
                const message = "Username is required";
                setError(message);
                notify({ variant: "error", title: "Validation error", message });
                return;
            }

            setUpdating(true);
            setError(null);
            try {
                const payload: any = {
                    username: editDraft.username.trim(),
                    role: editDraft.role as any,
                    ...(editDraft.password?.trim() ? { password: editDraft.password } : {}),
                };

                if (isMeSuperadmin) {
                    // If superadmin clears Group ID, treat as "unset" and omit.
                    const groupId = asStringOrEmpty(editDraft.group_id).trim();
                    if (groupId) payload.group_id = groupId;
                }

                await updateUser(editingUser.user_id, payload);

                editModal.closeModal();
                setEditingUser(null);
                setEditDraft({ username: "", role: "User", password: "", group_id: "" });
                notify({ variant: "success", title: "User updated", message: "User was updated successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to update user";
                setError(message);
                notify({ variant: "error", title: "Failed to update user", message });
            } finally {
                setUpdating(false);
            }
        },
        [editDraft.group_id, editDraft.password, editDraft.role, editDraft.username, editModal, editingUser, isMeSuperadmin, load, notify],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            if (!confirm("Delete this user?")) return;
            setError(null);
            try {
                await deleteUser(id);
                notify({ variant: "success", title: "User deleted", message: "User was deleted successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to delete user";
                setError(message);
                notify({ variant: "error", title: "Failed to delete user", message });
            }
        },
        [load, notify],
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Admin-only: create and manage users.</p>
                </div>
                <Button onClick={createModal.openModal}>New user</Button>
            </div>

            {/* Errors are surfaced via notifications; keep state for potential future inline UX. */}

            {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Username
                            </th>
                            {isMeSuperadmin && (
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Group ID
                                </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Role
                            </th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {sortedUsers.map((u) => (
                            <tr key={u.user_id} className="bg-white dark:bg-gray-900">
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{u.user_id}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{u.username}</td>
                                {isMeSuperadmin && (
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                        {u.group_id ?? "—"}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{u.role}</td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                                            Edit
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleDelete(u.user_id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {sortedUsers.length === 0 && (
                            <tr>
                                <td
                                    className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400"
                                    colSpan={isMeSuperadmin ? 5 : 4}
                                >
                                    No users found.
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
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                value={newUser.username}
                                onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                            />
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

                        {isMeSuperadmin && (
                            <div>
                                <Label htmlFor="group_id">Group ID</Label>
                                <Input
                                    id="group_id"
                                    name="group_id"
                                    type="text"
                                    value={asStringOrEmpty(newUser.group_id)}
                                    onChange={(e) => setNewUser((p) => ({ ...p, group_id: e.target.value }))}
                                />
                            </div>
                        )}

                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                value={newUser.password ?? ""}
                                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Button size="sm" variant="outline" onClick={createModal.closeModal} disabled={creating}>
                            Cancel
                        </Button>
                        <Button size="sm" type="submit" disabled={creating}>
                            {creating ? "Creating…" : "Create"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={editModal.isOpen} onClose={editModal.closeModal} className="max-w-[640px] p-5 lg:p-8">
                <form onSubmit={handleUpdate} className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">Edit user</h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="edit-username">Username</Label>
                            <Input
                                id="edit-username"
                                name="username"
                                type="text"
                                value={editDraft.username}
                                onChange={(e) => setEditDraft((p) => ({ ...p, username: e.target.value }))}
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-role">Role</Label>
                            <select
                                id="edit-role"
                                name="role"
                                value={editDraft.role}
                                onChange={(e) => setEditDraft((p) => ({ ...p, role: e.target.value }))}
                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            >
                                <option value="User">User</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>

                        {isMeSuperadmin && (
                            <div>
                                <Label htmlFor="edit-group_id">Group ID</Label>
                                <Input
                                    id="edit-group_id"
                                    name="group_id"
                                    type="text"
                                    value={asStringOrEmpty(editDraft.group_id)}
                                    onChange={(e) => setEditDraft((p) => ({ ...p, group_id: e.target.value }))}
                                />
                            </div>
                        )}

                        <div>
                            <Label htmlFor="edit-password">Password</Label>
                            <Input
                                id="edit-password"
                                name="password"
                                type="password"
                                value={editDraft.password ?? ""}
                                placeholder="Leave blank to keep current password"
                                onChange={(e) => setEditDraft((p) => ({ ...p, password: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                editModal.closeModal();
                                setEditingUser(null);
                            }}
                            disabled={updating}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" type="submit" disabled={updating || !editingUser}>
                            {updating ? "Saving…" : "Save"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
