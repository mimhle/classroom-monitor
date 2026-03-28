"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getBranches } from "@/libs/actions";
import { onBranchesChanged } from "@/libs/branchEvents";
import { deriveAlertBadge } from "@/libs/branchStatus";

type Branch = {
    branch_id: string;
    group_id?: string;
    name: string;
    alert?: unknown;
};

export default function Page() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = (await getBranches()) as any;
            const items = (res?.data ?? []) as Branch[];
            setBranches(Array.isArray(items) ? items : []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to fetch branches.";
            setError(msg);
            setBranches([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        loadBranches().catch((e) => {
            if (cancelled) return;
            console.error(e);
        });

        return () => {
            cancelled = true;
        };
    }, [loadBranches]);

    useEffect(() => {
        return onBranchesChanged(() => {
            loadBranches().catch((e) => console.error(e));
        });
    }, [loadBranches]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Branch status
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        All branches and their current alert status.
                    </p>
                </div>

                <ComponentCard
                    title={`Branches${!loading ? ` (${branches.length})` : ""}`}
                    desc={
                        loading
                            ? "Loading…"
                            : error
                                ? error
                                : branches.length === 0
                                    ? "No branches found."
                                    : ""
                    }
                >
                    {!loading && !error && branches.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b border-gray-100 dark:border-gray-800">
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Branch
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            ID
                                        </TableCell>
                                        <TableCell
                                            isHeader
                                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                        >
                                            Status
                                        </TableCell>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {branches.map((b) => {
                                        const badge = deriveAlertBadge(b.alert);
                                        return (
                                            <TableRow
                                                key={b.branch_id}
                                                className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                                            >
                                                <TableCell className="px-3 py-3">
                                                    <Link
                                                        href={`/branches/${encodeURIComponent(b.branch_id)}`}
                                                        className="font-medium text-gray-800 hover:underline dark:text-white/90"
                                                    >
                                                        {b.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <span
                                                        className="font-mono text-xs text-gray-600 dark:text-gray-300">
                                                        {b.branch_id}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-3 py-3">
                                                    <span title={badge.title} className="inline-flex whitespace-nowrap">
                                                        <Badge color={badge.color} variant={badge.variant} size="sm">
                                                            {badge.label}
                                                        </Badge>
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                </ComponentCard>
            </div>
        </div>
    );
}
