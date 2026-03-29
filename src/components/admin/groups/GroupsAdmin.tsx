"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { createGroup, deleteGroup, getGroups, type Group, updateGroup } from "@/libs/actions";
import { useNotification } from "@/components/ui/notification";

function asStringOrEmpty(v: unknown): string {
    if (typeof v === "string") return v;
    if (v == null) return "";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return "";
}

export default function GroupsAdmin() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const { notify } = useNotification();

    const createModal = useModal(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creating, setCreating] = useState(false);

    const editModal = useModal(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editName, setEditName] = useState("");
    const [updating, setUpdating] = useState(false);

    const sortedGroups = useMemo(() => {
        return [...groups].sort((a, b) => asStringOrEmpty(a.name).localeCompare(asStringOrEmpty(b.name)));
    }, [groups]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getGroups();
            setGroups(Array.isArray(data) ? data : []);
        } catch (e: any) {
            const message = e?.message ?? "Failed to load groups";
            setError(message);
            notify({ variant: "error", title: "Failed to load groups", message });
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const name = newGroupName.trim();
            if (!name) {
                const message = "Group name is required";
                setError(message);
                notify({ variant: "error", title: "Validation error", message });
                return;
            }

            setCreating(true);
            setError(null);
            try {
                await createGroup({ name });
                createModal.closeModal();
                setNewGroupName("");
                notify({ variant: "success", title: "Group created", message: "Group was created successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to create group";
                setError(message);
                notify({ variant: "error", title: "Failed to create group", message });
            } finally {
                setCreating(false);
            }
        },
        [createModal, load, newGroupName, notify],
    );

    const openEdit = useCallback(
        (g: Group) => {
            setEditingGroup(g);
            setEditName(asStringOrEmpty(g.name));
            editModal.openModal();
        },
        [editModal],
    );

    const handleUpdate = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!editingGroup) return;

            const name = editName.trim();
            if (!name) {
                const message = "Group name is required";
                setError(message);
                notify({ variant: "error", title: "Validation error", message });
                return;
            }

            setUpdating(true);
            setError(null);
            try {
                await updateGroup(editingGroup.group_id, { name });
                editModal.closeModal();
                setEditingGroup(null);
                setEditName("");
                notify({ variant: "success", title: "Group updated", message: "Group was updated successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to update group";
                setError(message);
                notify({ variant: "error", title: "Failed to update group", message });
            } finally {
                setUpdating(false);
            }
        },
        [editModal, editName, editingGroup, load, notify],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            if (!confirm("Delete this group?")) return;
            setError(null);
            try {
                await deleteGroup(id);
                notify({ variant: "success", title: "Group deleted", message: "Group was deleted successfully." });
                await load();
            } catch (e: any) {
                const message = e?.message ?? "Failed to delete group";
                setError(message);
                notify({ variant: "error", title: "Failed to delete group", message });
            }
        },
        [load, notify],
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Groups</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Superadmin-only: create and manage
                        groups.</p>
                </div>
                <Button onClick={createModal.openModal}>New group</Button>
            </div>

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
                                Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                Created
                            </th>
                            <th className="px-4 py-3"></th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {sortedGroups.map((g) => (
                            <tr key={g.group_id} className="bg-white dark:bg-gray-900">
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{g.group_id}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{g.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                    {g.created_at ? new Date(g.created_at).toLocaleString() : "—"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                                            Edit
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleDelete(g.group_id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {sortedGroups.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                                    No groups found.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[640px] p-5 lg:p-8">
                <form onSubmit={handleCreate} className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">Create group</h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="group-name">Group name</Label>
                            <Input
                                id="group-name"
                                name="name"
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
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
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">Edit group</h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="edit-group-name">Group name</Label>
                            <Input
                                id="edit-group-name"
                                name="name"
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                editModal.closeModal();
                                setEditingGroup(null);
                            }}
                            disabled={updating}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" type="submit" disabled={updating || !editingGroup}>
                            {updating ? "Saving…" : "Save"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
