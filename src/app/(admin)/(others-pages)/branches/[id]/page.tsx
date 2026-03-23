"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteBranch, getBranch } from "@/libs/actions";
import Button from "@/components/ui/button/Button";
import { TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";

type Branch = {
    branch_id: string;
    group_id: string;
    name: string;
    alert: unknown;
};

export default function BranchPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { notify } = useNotification();

    const id = params?.id;

    const [branch, setBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setLoading(true);
            try {
                const data = (await getBranch(id)) as Branch | null;
                if (cancelled) return;

                if (!data) {
                    router.replace("/_not-found");
                    return;
                }

                setBranch(data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id, router]);

    async function onDelete() {
        if (!id || !branch) {
            notify({
                variant: "error",
                title: "Delete failed",
                message: "Missing branch id.",
            });
            return;
        }

        const ok = window.confirm(
            `Delete branch “${branch.name}” (${branch.branch_id})? This can’t be undone.`,
        );
        if (!ok) return;

        setIsDeleting(true);
        try {
            await deleteBranch(id);
            notify({
                variant: "success",
                title: "Branch deleted",
                message: `“${branch.name}” was deleted successfully.`,
            });

            // No list page exists in this repo yet, so go back to where the user came from.
            router.back();
            router.refresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete branch.";
            notify({ variant: "error", title: "Delete failed", message: msg });
        } finally {
            setIsDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-4xl">
                    <div
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!branch) return null;

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-4xl">
                <div className="flex flex-row justify-between">
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                            {branch.name}
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Branch ID: <span className="font-mono">{branch.branch_id}</span>
                        </p>
                    </div>
                    <div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="ring-orange-600 bg-orange-100"
                            onClick={onDelete}
                            disabled={isDeleting}
                        >
                            <TrashBinIcon/>
                        </Button>
                    </div>
                </div>

                <div
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                Group ID
                            </dt>
                            <dd className="mt-1 font-mono text-sm text-gray-800 dark:text-white/90">
                                {branch.group_id}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                Alerts
                            </dt>
                            <dd className="mt-1 text-sm text-gray-800 dark:text-white/90">
                            <pre
                                className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              {JSON.stringify(branch.alert, null, 2)}
                            </pre>
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
}