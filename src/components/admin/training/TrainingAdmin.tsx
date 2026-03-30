"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useNotification } from "@/components/ui/notification";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import {
    type Branch,
    createJob,
    type CreateJobInput,
    deleteModel,
    getAllModels,
    getBranches,
    getJobDefaultParams,
    getJobs,
    type Job,
    type Model,
    type SensorField,
    updateModel,
} from "@/libs/actions";
import { TrashBinIcon } from "@/icons";

const SENSOR_FIELDS: SensorField[] = ["co2", "temp", "rh", "vbat", "lux", "mic", "pm2_5", "pm10"];

function parseCsvNumbers(value: string): number[] {
    return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
}

function formatCsvNumbers(nums: number[] | undefined): string {
    if (!Array.isArray(nums) || nums.length === 0) return "";
    return nums.join(",");
}

function toLocalDateTimeInputValue(iso: string | undefined | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalDateTimeInputValue(v: string): string {
    // Input is local time without timezone; convert to ISO.
    const d = new Date(v);
    return d.toISOString();
}

function validateJobDraft(draft: CreateJobInput | null): string[] {
    if (!draft) return ["Training parameters aren't loaded yet."];

    const errors: string[] = [];
    const { dataset, forecast, model_hyperparams, feature_engineering } = draft;

    if (!dataset?.branch_id) errors.push("Branch is required.");
    if (!dataset?.date_from) errors.push("Date from is required.");
    if (!dataset?.date_to) errors.push("Date to is required.");

    if (dataset?.date_from && dataset?.date_to) {
        const from = Date.parse(dataset.date_from);
        const to = Date.parse(dataset.date_to);
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
            errors.push("Dates must be valid.");
        } else if (from >= to) {
            errors.push("Date from must be earlier than date to.");
        }
    }

    if (!Array.isArray(dataset?.features) || dataset.features.length === 0) {
        errors.push("At least one feature is required.");
    }
    if (!Array.isArray(dataset?.targets) || dataset.targets.length === 0) {
        errors.push("At least one target is required.");
    }

    if (!forecast || forecast.horizon <= 0) errors.push("Horizon must be > 0.");
    if (!forecast || forecast.step_ahead <= 0) errors.push("Step ahead must be > 0.");

    const learningRate = model_hyperparams?.learning_rate;
    const subsample = model_hyperparams?.subsample;
    const colsample = model_hyperparams?.colsample_bytree;

    const checkRate = (name: string, v: number | undefined) => {
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1) {
            errors.push(`${name} must be a number in (0, 1].`);
        }
    };

    checkRate("learning_rate", learningRate);
    checkRate("subsample", subsample);
    checkRate("colsample_bytree", colsample);

    if (!model_hyperparams || model_hyperparams.n_estimators <= 0) errors.push("n_estimators must be > 0.");
    if (!model_hyperparams || model_hyperparams.max_depth <= 0) errors.push("max_depth must be > 0.");

    if (!feature_engineering) return errors;

    if (!Array.isArray(feature_engineering.lags)) errors.push("lags must be a list of numbers.");
    if (!Array.isArray(feature_engineering.rolls)) errors.push("rolls must be a list of numbers.");

    return errors;
}

function truncateMiddle(value: string, head = 6, tail = 6): string {
    if (!value) return "";
    if (value.length <= head + tail + 3) return value;
    return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function parseMaybeJson<T = unknown>(value: unknown): T | unknown {
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return value;

    // Only attempt JSON parse when it looks like JSON. This avoids turning
    // plain strings into errors/noise.
    const looksJson =
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        trimmed === "null" ||
        trimmed === "true" ||
        trimmed === "false" ||
        /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed);

    if (!looksJson) return value;

    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return value;
    }
}

export default function TrainingAdmin() {
    const { notify } = useNotification();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [models, setModels] = useState<Model[]>([]);

    // Keep this as UI state, but treat draft.dataset.branch_id as the source of truth.
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");

    const [draft, setDraft] = useState<CreateJobInput | null>(null);

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const [isParamsOpen, setIsParamsOpen] = useState(true);

    // Model rename modal state
    const editModelModal = useModal(false);
    const [editingModel, setEditingModel] = useState<Model | null>(null);
    const [editingModelName, setEditingModelName] = useState<string>("");
    const [modelSaving, setModelSaving] = useState(false);

    // Model delete modal state
    const deleteModelModal = useModal(false);
    const [deletingModel, setDeletingModel] = useState<Model | null>(null);
    const [modelDeleting, setModelDeleting] = useState(false);

    // Job params modal state
    const jobParamsModal = useModal(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    const refreshTimer = useRef<number | null>(null);

    const filteredJobs = useMemo(() => {
        if (!selectedBranchId) return jobs;
        return jobs.filter((j) => j.branch_id === selectedBranchId);
    }, [jobs, selectedBranchId]);

    const filteredModels = useMemo(() => {
        if (!selectedBranchId) return models;
        return models.filter((m) => m.branch_id === selectedBranchId);
    }, [models, selectedBranchId]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [branchesRes, defaults, jobsData, modelsRes] = await Promise.all([
                getBranches(),
                getJobDefaultParams(),
                getJobs(),
                getAllModels(),
            ]);

            // getBranches() returns varying shapes across the app.
            const b: Branch[] = Array.isArray((branchesRes as any)?.data)
                ? ((branchesRes as any).data as Branch[])
                : Array.isArray((branchesRes as any)?.items)
                    ? ((branchesRes as any).items as Branch[])
                    : Array.isArray(branchesRes)
                        ? (branchesRes as Branch[])
                        : [];
            setBranches(b);
            setJobs(Array.isArray(jobsData) ? jobsData : []);
            setModels(modelsRes.items);
            setDraft(defaults ?? null);

            // If backend provides a default branch_id, use it to preselect the UI.
            const defaultBranchId = (defaults as any)?.dataset?.branch_id;
            if (typeof defaultBranchId === "string" && defaultBranchId.length > 0) {
                setSelectedBranchId(defaultBranchId);
            }
        } catch (e: any) {
            notify({
                variant: "error",
                title: "Failed to load training page",
                message: e?.message ?? "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    }, [notify]);

    const refreshJobsAndModels = useCallback(async () => {
        try {
            const [jobsData, modelsRes] = await Promise.all([getJobs(), getAllModels()]);
            setJobs(Array.isArray(jobsData) ? jobsData : []);
            setModels(modelsRes.items);
        } catch {
            // Keep quiet while auto-refreshing.
        }
    }, []);

    const openEditModel = useCallback(
        (m: Model) => {
            setEditingModel(m);
            setEditingModelName(m.name ?? "");
            editModelModal.openModal();
        },
        [editModelModal],
    );

    const closeEditModel = useCallback(() => {
        if (modelSaving) return;
        editModelModal.closeModal();
        setEditingModel(null);
        setEditingModelName("");
    }, [editModelModal, modelSaving]);

    const openDeleteModel = useCallback(
        (m: Model) => {
            setDeletingModel(m);
            deleteModelModal.openModal();
        },
        [deleteModelModal],
    );

    const closeDeleteModel = useCallback(() => {
        if (modelDeleting) return;
        deleteModelModal.closeModal();
        setDeletingModel(null);
    }, [deleteModelModal, modelDeleting]);

    const openJobParams = useCallback(
        (j: Job) => {
            setSelectedJob(j);
            jobParamsModal.openModal();
        },
        [jobParamsModal],
    );

    const closeJobParams = useCallback(() => {
        jobParamsModal.closeModal();
        setSelectedJob(null);
    }, [jobParamsModal]);

    const handleSaveModelName = useCallback(async () => {
        const m = editingModel;
        const nextName = editingModelName.trim();

        if (!m) return;
        if (!nextName) {
            notify({
                variant: "error",
                title: "Invalid name",
                message: "Model name can't be empty.",
            });
            return;
        }

        setModelSaving(true);
        try {
            const updated = await updateModel(m.model_id, nextName);
            notify({
                variant: "success",
                title: "Model updated",
                message: `Renamed to ${updated.name}.`,
            });
            // Update local state quickly, then refresh from server.
            setModels((prev) => prev.map((x) => (x.model_id === updated.model_id ? updated : x)));
            closeEditModel();
            await refreshJobsAndModels();
        } catch (e: any) {
            notify({
                variant: "error",
                title: "Failed to update model",
                message: e?.message ?? "Please try again.",
            });
        } finally {
            setModelSaving(false);
        }
    }, [closeEditModel, editingModel, editingModelName, notify, refreshJobsAndModels]);

    const handleConfirmDeleteModel = useCallback(async () => {
        const m = deletingModel;
        if (!m) return;

        setModelDeleting(true);
        try {
            await deleteModel(m.model_id);
            notify({
                variant: "success",
                title: "Model deleted",
                message: `${m.name ?? "Model"} deleted.`,
            });
            // Optimistic update, then reconcile.
            setModels((prev) => prev.filter((x) => x.model_id !== m.model_id));
            closeDeleteModel();
            await refreshJobsAndModels();
        } catch (e: any) {
            notify({
                variant: "error",
                title: "Failed to delete model",
                message: e?.message ?? "Please try again.",
            });
        } finally {
            setModelDeleting(false);
        }
    }, [closeDeleteModel, deletingModel, notify, refreshJobsAndModels]);

    useEffect(() => {
        load();
        return () => {
            if (refreshTimer.current) window.clearInterval(refreshTimer.current);
        };
    }, [load]);

    // Keep draft.branch_id in sync with selection.
    useEffect(() => {
        setDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                dataset: {
                    ...prev.dataset,
                    branch_id: selectedBranchId,
                },
            };
        });
    }, [selectedBranchId]);

    // If the draft loads/changes with a branch_id, ensure the UI reflects it.
    useEffect(() => {
        const draftBranchId = draft?.dataset?.branch_id;
        if (typeof draftBranchId === "string" && draftBranchId !== selectedBranchId) {
            setSelectedBranchId(draftBranchId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft?.dataset?.branch_id]);

    // Auto-refresh job + model lists every 5s.
    useEffect(() => {
        if (refreshTimer.current) {
            window.clearInterval(refreshTimer.current);
            refreshTimer.current = null;
        }

        refreshTimer.current = window.setInterval(() => {
            refreshJobsAndModels();
        }, 5000);

        return () => {
            if (refreshTimer.current) window.clearInterval(refreshTimer.current);
            refreshTimer.current = null;
        };
    }, [refreshJobsAndModels]);

    const errors = useMemo(() => validateJobDraft(draft), [draft]);
    const branchSelected = Boolean(draft?.dataset?.branch_id);
    const canSubmit = errors.length === 0 && branchSelected && !creating;

    // If there are validation errors, keep parameters visible so the user can fix them.
    useEffect(() => {
        if (errors.length > 0) setIsParamsOpen(true);
    }, [errors.length]);

    const handleStartTraining = useCallback(async () => {
        const current = draft;
        const validation = validateJobDraft(current);
        if (validation.length > 0) {
            notify({
                variant: "error",
                title: "Validation error",
                message: validation[0],
            });
            return;
        }

        setCreating(true);
        try {
            const res = await createJob(current as CreateJobInput);
            notify({
                variant: "success",
                title: "Training started",
                message: `Job ${res.job_id} is ${res.status}.`,
            });
            setIsParamsOpen(false);
            await refreshJobsAndModels();
        } catch (e: any) {
            notify({
                variant: "error",
                title: "Failed to start training",
                message: e?.message ?? "Please try again.",
            });
        } finally {
            setCreating(false);
        }
    }, [draft, notify, refreshJobsAndModels]);

    const updateDraft = useCallback((patch: Partial<CreateJobInput>) => {
        setDraft((prev) => (prev ? ({ ...prev, ...patch } as CreateJobInput) : prev));
    }, []);

    const dataset = draft?.dataset;
    const fe = draft?.feature_engineering;
    const forecast = draft?.forecast;
    const hp = draft?.model_hyperparams;

    if (loading) {
        return <div className="text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Model training</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure and start a training job for a branch (scoped to a group).
                </p>
            </div>

            {/* Training params */}
            <div
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-5 bg-white dark:bg-gray-900">
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 text-left"
                    aria-expanded={isParamsOpen}
                    onClick={() => setIsParamsOpen((v) => !v)}
                >
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Training parameters</h2>
                    <span
                        className={`inline-flex items-center text-gray-500 dark:text-gray-400 transition-transform ${
                            isParamsOpen ? "rotate-180" : "rotate-0"
                        }`}
                        aria-hidden
                    >
                        {/* Simple chevron */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M6 9L12 15L18 9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                </button>

                {isParamsOpen && (
                    <div className="space-y-5">
                        <div>
                            <Label>Branch</Label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                value={draft?.dataset?.branch_id ?? ""}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                required
                            >
                                <option value="">Select a branch to collect data…</option>
                                {branches.map((b) => (
                                    <option key={b.branch_id} value={b.branch_id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Date from</Label>
                                <Input
                                    type="datetime-local"
                                    value={toLocalDateTimeInputValue(dataset?.date_from)}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (!v) return;
                                        updateDraft({
                                            dataset: {
                                                ...(dataset as any),
                                                date_from: toIsoFromLocalDateTimeInputValue(v),
                                            },
                                        } as any);
                                    }}
                                />
                            </div>
                            <div>
                                <Label>Date to</Label>
                                <Input
                                    type="datetime-local"
                                    value={toLocalDateTimeInputValue(dataset?.date_to)}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (!v) return;
                                        updateDraft({
                                            dataset: {
                                                ...(dataset as any),
                                                date_to: toIsoFromLocalDateTimeInputValue(v),
                                            },
                                        } as any);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Features</Label>
                                <select
                                    multiple
                                    className="w-full min-h-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    value={(dataset?.features as any) ?? []}
                                    onChange={(e) => {
                                        const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                                        updateDraft({
                                            dataset: {
                                                ...(dataset as any),
                                                features: values as any,
                                            },
                                        } as any);
                                    }}
                                >
                                    {SENSOR_FIELDS.map((f) => (
                                        <option key={f} value={f}>
                                            {f}
                                        </option>
                                    ))}
                                    <option value="people">people</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Hold Ctrl/⌘ to select
                                    multiple.</p>
                            </div>

                            <div>
                                <Label>Targets</Label>
                                <select
                                    multiple
                                    className="w-full min-h-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    value={(dataset?.targets as any) ?? []}
                                    onChange={(e) => {
                                        const values = Array.from(e.target.selectedOptions).map((o) => o.value) as SensorField[];
                                        updateDraft({
                                            dataset: {
                                                ...(dataset as any),
                                                targets: values,
                                            },
                                        } as any);
                                    }}
                                >
                                    {SENSOR_FIELDS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Training produces forecasts
                                    for these.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Lags (comma-separated)</Label>
                                <Input
                                    value={formatCsvNumbers(fe?.lags)}
                                    onChange={(e) => {
                                        const nums = parseCsvNumbers(e.target.value);
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                lags: nums,
                                            },
                                        } as any);
                                    }}
                                    placeholder="e.g. 1,2,3"
                                />
                            </div>
                            <div>
                                <Label>Rolls (comma-separated)</Label>
                                <Input
                                    value={formatCsvNumbers(fe?.rolls)}
                                    onChange={(e) => {
                                        const nums = parseCsvNumbers(e.target.value);
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                rolls: nums,
                                            },
                                        } as any);
                                    }}
                                    placeholder="e.g. 3,6,12"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(fe?.use_time_features)}
                                    onChange={(e) =>
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                use_time_features: e.target.checked,
                                            },
                                        } as any)
                                    }
                                />
                                Use time features
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(fe?.use_diff_features)}
                                    onChange={(e) =>
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                use_diff_features: e.target.checked,
                                            },
                                        } as any)
                                    }
                                />
                                Use diff features
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(fe?.use_occupancy)}
                                    onChange={(e) =>
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                use_occupancy: e.target.checked,
                                            },
                                        } as any)
                                    }
                                />
                                Use occupancy
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(fe?.use_interaction)}
                                    onChange={(e) =>
                                        updateDraft({
                                            feature_engineering: {
                                                ...(fe as any),
                                                use_interaction: e.target.checked,
                                            },
                                        } as any)
                                    }
                                />
                                Use interaction
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Horizon</Label>
                                <Input
                                    type="number"
                                    value={forecast?.horizon ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            forecast: {
                                                ...(forecast as any),
                                                horizon: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                            <div>
                                <Label>Step ahead</Label>
                                <Input
                                    type="number"
                                    value={forecast?.step_ahead ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            forecast: {
                                                ...(forecast as any),
                                                step_ahead: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>n_estimators</Label>
                                <Input
                                    type="number"
                                    value={hp?.n_estimators ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            model_hyperparams: {
                                                ...(hp as any),
                                                n_estimators: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                            <div>
                                <Label>max_depth</Label>
                                <Input
                                    type="number"
                                    value={hp?.max_depth ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            model_hyperparams: {
                                                ...(hp as any),
                                                max_depth: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                            <div>
                                <Label>learning_rate</Label>
                                <Input
                                    type="number"
                                    step={0.01}
                                    value={hp?.learning_rate ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            model_hyperparams: {
                                                ...(hp as any),
                                                learning_rate: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                            <div>
                                <Label>subsample</Label>
                                <Input
                                    type="number"
                                    step={0.01}
                                    value={hp?.subsample ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            model_hyperparams: {
                                                ...(hp as any),
                                                subsample: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                            <div>
                                <Label>colsample_bytree</Label>
                                <Input
                                    type="number"
                                    step={0.01}
                                    value={hp?.colsample_bytree ?? 0}
                                    onChange={(e) =>
                                        updateDraft({
                                            model_hyperparams: {
                                                ...(hp as any),
                                                colsample_bytree: Number(e.target.value),
                                            },
                                        } as any)
                                    }
                                />
                            </div>
                        </div>
                        {errors.length > 0 && (
                            <div className="text-sm text-red-600 dark:text-red-400">{errors[0]}</div>
                        )}

                        <div className="flex items-center gap-2">
                            <Button disabled={!canSubmit} onClick={handleStartTraining}>
                                {creating ? "Starting…" : "Start training"}
                            </Button>
                            <Button variant="outline" onClick={refreshJobsAndModels} disabled={creating}>
                                Refresh
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Job history */}
            <div
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Job history</h2>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Showing {filteredJobs.length} jobs</div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Job</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Message</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Model</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredJobs
                            .slice()
                            .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0))
                            .map((j) => (
                                <tr
                                    key={j.job_id}
                                    className="bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openJobParams(j)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openJobParams(j);
                                        }
                                    }}
                                >
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        <span
                                            className="font-mono"
                                            title={j.job_id}
                                            aria-label={`Job id ${j.job_id}`}
                                        >
                                            {truncateMiddle(j.job_id)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{j.status}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                        {j.created_at ? new Date(j.created_at).toLocaleString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{j.message ?? "—"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                        {j.model_name ?? j.model_id ?? "—"}
                                    </td>
                                </tr>
                            ))}
                        {filteredJobs.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={5}>
                                    No jobs yet.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Models */}
            <div
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Models</h2>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Showing {filteredModels.length} models
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Version</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredModels
                            .slice()
                            .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0))
                            .map((m) => (
                                <tr key={m.model_id} className="bg-white dark:bg-gray-900">
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{m.model_id}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{m.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{m.version}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                        {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" onClick={() => openEditModel(m)}>
                                                Rename
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                                onClick={() => openDeleteModel(m)}
                                            >
                                                <TrashBinIcon/>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {filteredModels.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={5}>
                                    No models yet.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={editModelModal.isOpen} onClose={closeEditModel}
                   className="max-w-[700px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Edit model
                            name</h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            Rename the model for easier identification.
                        </p>
                    </div>

                    <form
                        className="flex flex-col"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveModelName();
                        }}
                    >
                        <div className="custom-scrollbar h-fit overflow-y-hidden px-2 pb-3">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-5">
                                <div>
                                    <Label>Model</Label>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                        {editingModel?.model_id ?? ""}
                                    </div>
                                </div>
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        type="text"
                                        value={editingModelName}
                                        onChange={(e: any) => setEditingModelName(e.target.value)}
                                        placeholder="Enter model name"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                            <Button size="sm" variant="outline" type="button" onClick={closeEditModel}>
                                Close
                            </Button>
                            <Button size="sm" disabled={modelSaving || !editingModelName.trim()} type="submit">
                                {modelSaving ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal isOpen={deleteModelModal.isOpen} onClose={closeDeleteModel}
                   className="max-w-[700px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Delete model</h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            This can&apos;t be undone. Any branches or pages referencing this model may break.
                        </p>
                    </div>

                    <div className="px-2 pb-3 space-y-2">
                        <div>
                            <Label>Model</Label>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono"
                                 title={deletingModel?.model_id ?? ""}>
                                {deletingModel?.model_id ? deletingModel.model_id : ""}
                            </div>
                        </div>
                        <div>
                            <Label>Name</Label>
                            <div className="text-sm text-gray-900 dark:text-gray-100">{deletingModel?.name ?? "—"}</div>
                        </div>
                        <div>
                            <Label>Date created</Label>
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                                {deletingModel?.created_at ? new Date(deletingModel.created_at).toLocaleString() : "—"}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                        <Button size="sm" variant="outline" type="button" onClick={closeDeleteModel}
                                disabled={modelDeleting}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            type="button"
                            onClick={handleConfirmDeleteModel}
                            disabled={modelDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-700"
                        >
                            {modelDeleting ? "Deleting…" : "Delete"}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={jobParamsModal.isOpen} onClose={closeJobParams}
                   className="max-w-[900px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[900px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Job parameters</h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            Details for job <span className="font-mono">{selectedJob?.job_id ?? ""}</span>
                        </p>
                    </div>

                    <div className="px-2 pb-3 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Status</Label>
                                <div
                                    className="text-sm text-gray-900 dark:text-gray-100">{selectedJob?.status ?? "—"}</div>
                            </div>
                            <div>
                                <Label>Created</Label>
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {selectedJob?.created_at ? new Date(selectedJob.created_at).toLocaleString() : "—"}
                                </div>
                            </div>
                            <div>
                                <Label>Branch</Label>
                                <div
                                    className="text-sm text-gray-900 dark:text-gray-100 font-mono">{selectedJob?.branch_id ?? "—"}</div>
                            </div>
                            <div>
                                <Label>Model</Label>
                                <div
                                    className="text-sm text-gray-900 dark:text-gray-100">{selectedJob?.model_name ?? selectedJob?.model_id ?? "—"}</div>
                            </div>
                        </div>

                        <div>
                            <Label>Params</Label>
                            <pre
                                className="mt-2 max-h-[400px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
                                {(() => {
                                    const job: any = selectedJob as any;

                                    // Jobs come back in varying shapes. The params payload might be nested.
                                    const root = job?.params ?? job?.job_params ?? job?.payload ?? job?.input ?? job ?? null;

                                    const pick = (key: string) => parseMaybeJson((root as any)?.[key]);

                                    const toShow = {
                                        dataset_params: pick("dataset_params"),
                                        feature_engineering_params: pick("feature_engineering_params"),
                                        forecast_params: pick("forecast_params"),
                                        model_hyperparams: pick("model_hyperparams"),
                                        result: pick("result"),
                                    };

                                    try {
                                        return JSON.stringify(toShow, null, 2);
                                    } catch {
                                        return String(toShow);
                                    }
                                })()}
                            </pre>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                        <Button size="sm" variant="outline" type="button" onClick={closeJobParams}>
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
