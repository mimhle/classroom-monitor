"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    type Alert,
    type Branch,
    type BranchPrediction,
    type Camera,
    createCamera,
    createSensor,
    deleteBranch,
    getBranch,
    getBranchAlerts,
    getBranchCameras,
    getBranchSensors,
    getCameraStatus,
    getPrediction,
    markAlertAsRead,
    type Sensor,
    updateBranch,
} from "@/libs/actions";
import Button from "@/components/ui/button/Button";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import ComponentCard from "@/components/common/ComponentCard";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { getCurrentUser } from "@/libs/auth";
import { isAdminOrSuperadmin } from "@/libs/roles";
import Badge from "@/components/ui/badge/Badge";
import { deriveAlertBadge } from "@/libs/branchStatus";
import PredictionSparkline from "@/components/charts/sparkline/PredictionSparkline";
import SensorStatusBadge from "@/components/common/SensorStatusBadge";

export default function BranchDetailsPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { notify } = useNotification();

    const id = params?.id;
    const highlightedAlertId = searchParams?.get("alert");

    const [branch, setBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [sensorsLoading, setSensorsLoading] = useState(false);
    const [sensorsError, setSensorsError] = useState<string | null>(null);

    const [cameras, setCameras] = useState<Camera[]>([]);
    const [camerasLoading, setCamerasLoading] = useState(false);
    const [camerasError, setCamerasError] = useState<string | null>(null);

    const [cameraStatuses, setCameraStatuses] = useState<Record<string, "online" | "offline" | "unknown">>({});

    const [prediction, setPrediction] = useState<BranchPrediction | null>(null);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [predictionError, setPredictionError] = useState<string | null>(null);

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertsError, setAlertsError] = useState<string | null>(null);

    // Add camera modal/state (mirrors create sensor)
    const createCameraModal = useModal(false);
    const [cameraName, setCameraName] = useState("");
    const [isCreatingCamera, setIsCreatingCamera] = useState(false);
    const [createCameraError, setCreateCameraError] = useState<string | null>(null);

    // Newly created camera secret modal/state
    const cameraSecretModal = useModal(false);
    const [createdCameraId, setCreatedCameraId] = useState<string | null>(null);
    const [createdCameraSecret, setCreatedCameraSecret] = useState<string | null>(null);

    const createSensorModal = useModal(false);
    const [sensorName, setSensorName] = useState("");
    const [isCreatingSensor, setIsCreatingSensor] = useState(false);
    const [createSensorError, setCreateSensorError] = useState<string | null>(null);

    const editBranchModal = useModal(false);
    const [branchName, setBranchName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);

    const [editUserGroupId, setEditUserGroupId] = useState<string | null>(null);

    const [canEdit, setCanEdit] = useState(false);

    // Disable creating more cameras if at least one already exists in this branch.
    // Note: we only enforce this when the cameras list has loaded successfully.
    const hasCameras = useMemo(() => {
        return !camerasLoading && !camerasError && cameras.length > 0;
    }, [cameras, camerasLoading, camerasError]);
    const disableAddCamera = useMemo(() => {
        return canEdit && hasCameras;
    }, [canEdit, hasCameras]);

    // Disable creating more sensors if at least one already exists in this branch.
    // Note: we only enforce this when the sensors list has loaded successfully.
    const hasSensors = useMemo(() => {
        return !sensorsLoading && !sensorsError && sensors.length > 0;
    }, [sensors, sensorsLoading, sensorsError]);
    const disableAddSensor = useMemo(() => {
        return canEdit && hasSensors;
    }, [canEdit, hasSensors]);

    useEffect(() => {
        let cancelled = false;
        getCurrentUser()
            .then((user) => {
                if (cancelled) return;
                setCanEdit(isAdminOrSuperadmin(user));

                const gid = (user as any)?.group_id as string | undefined;
                setEditUserGroupId(gid ?? null);
            })
            .catch(() => {
                if (cancelled) return;
                setCanEdit(false);
                setEditUserGroupId(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

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

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setSensorsLoading(true);
            setSensorsError(null);
            try {
                const data = (await getBranchSensors(id)).items as Sensor[];
                if (cancelled) return;
                setSensors(Array.isArray(data) ? data : []);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load sensors.";
                setSensorsError(msg);
                setSensors([]);
            } finally {
                if (!cancelled) setSensorsLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setCamerasLoading(true);
            setCamerasError(null);
            try {
                const data = await getBranchCameras(id);
                if (cancelled) return;
                setCameras(Array.isArray(data?.items) ? data.items : []);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load cameras.";
                setCamerasError(msg);
                setCameras([]);
            } finally {
                if (!cancelled) setCamerasLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setPredictionLoading(true);
            setPredictionError(null);
            try {
                const data = await getPrediction(id);
                if (cancelled) return;
                setPrediction((data as any)?.prediction ?? null);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load prediction.";
                setPredictionError(msg);
                setPrediction(null);
            } finally {
                if (!cancelled) setPredictionLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!id) return;

            setAlertsLoading(true);
            setAlertsError(null);
            try {
                const items = await getBranchAlerts(id);
                if (cancelled) return;
                setAlerts(Array.isArray(items) ? items : []);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load alerts.";
                setAlertsError(msg);
                setAlerts([]);
            } finally {
                if (!cancelled) setAlertsLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        if (!highlightedAlertId) return;

        // Delay scroll until DOM paints.
        const t = window.setTimeout(() => {
            const el = document.getElementById(`alert-${highlightedAlertId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 150);

        return () => {
            window.clearTimeout(t);
        };
    }, [highlightedAlertId, alertsLoading, alerts.length]);

    async function handleAlertMarkRead(alert: Alert) {
        if (!id) return;
        if (alert.is_read) return;

        setAlerts((prev) => prev.map((a) => (a.alert_id === alert.alert_id ? { ...a, is_read: true } : a)));
        try {
            await markAlertAsRead(id, alert.alert_id);
        } catch {
            setAlerts((prev) => prev.map((a) => (a.alert_id === alert.alert_id ? { ...a, is_read: false } : a)));
        }
    }

    async function refreshSensors() {
        if (!id) return;
        setSensorsLoading(true);
        setSensorsError(null);
        try {
            const data = (await getBranchSensors(id)).items as Sensor[];
            setSensors(Array.isArray(data) ? data : []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load sensors.";
            setSensorsError(msg);
            setSensors([]);
        } finally {
            setSensorsLoading(false);
        }
    }

    async function refreshCameras() {
        if (!id) return;
        setCamerasLoading(true);
        setCamerasError(null);
        try {
            const data = await getBranchCameras(id);
            setCameras(Array.isArray(data?.items) ? data.items : []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load cameras.";
            setCamerasError(msg);
            setCameras([]);
        } finally {
            setCamerasLoading(false);
        }
    }

    async function refreshPrediction() {
        if (!id) return;
        setPredictionLoading(true);
        setPredictionError(null);
        try {
            const data = await getPrediction(id);
            setPrediction((data as any)?.prediction ?? null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load prediction.";
            setPredictionError(msg);
            setPrediction(null);
        } finally {
            setPredictionLoading(false);
        }
    }

    async function refreshCameraStatuses(targetCameras?: Camera[]) {
        const camList = Array.isArray(targetCameras) ? targetCameras : cameras;
        if (camList.length === 0) return;

        const concurrency = 6;
        const next: Record<string, "online" | "offline" | "unknown"> = {};

        for (let i = 0; i < camList.length; i += concurrency) {
            const chunk = camList.slice(i, i + concurrency);
            const results = await Promise.all(
                chunk.map(async (c) => {
                    try {
                        const res = await getCameraStatus(c.camera_id);
                        return [c.camera_id, res.status] as const;
                    } catch {
                        return [c.camera_id, "unknown"] as const;
                    }
                }),
            );

            for (const [cameraId, status] of results) {
                next[cameraId] = status;
            }
        }

        setCameraStatuses((prev) => ({ ...prev, ...next }));
    }

    // After cameras are loaded, fetch their statuses once.
    useEffect(() => {
        if (!camerasLoading && !camerasError && cameras.length > 0) {
            void refreshCameraStatuses(cameras);
        }
        if (!camerasLoading && !camerasError && cameras.length === 0) {
            setCameraStatuses({});
        }
    }, [camerasLoading, camerasError, cameras]);

    // Poll camera statuses periodically (pause when tab is hidden).
    useEffect(() => {
        if (!id) return;
        if (camerasLoading || camerasError || cameras.length === 0) return;

        let cancelled = false;
        const interval = window.setInterval(() => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") return;
            void refreshCameraStatuses();
        }, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [id, camerasLoading, camerasError, cameras.length]);

    // Auto-refresh prediction every 5s (pause when tab is hidden).
    useEffect(() => {
        if (!id) return;

        let cancelled = false;
        let inFlight = false;

        const tick = async () => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") return;
            if (inFlight) return;
            inFlight = true;
            try {
                const data = await getPrediction(id);
                if (cancelled) return;
                setPrediction((data as any)?.prediction ?? null);
                setPredictionError(null);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load prediction.";
                setPredictionError(msg);
            } finally {
                inFlight = false;
            }
        };

        // Run once shortly after mount/branch change.
        const initial = window.setTimeout(() => {
            void tick();
        }, 250);

        const interval = window.setInterval(() => {
            void tick();
        }, 5000);

        return () => {
            cancelled = true;
            window.clearTimeout(initial);
            window.clearInterval(interval);
        };
    }, [id]);

    function openCreateSensorModal() {
        if (!canEdit) return;
        if (disableAddSensor) return;
        setSensorName("");
        setCreateSensorError(null);
        createSensorModal.openModal();
    }

    function closeCreateSensorModal() {
        createSensorModal.closeModal();
        setSensorName("");
        setCreateSensorError(null);
    }

    function openCreateCameraModal() {
        if (!canEdit) return;
        if (disableAddCamera) return;
        setCameraName("");
        setCreateCameraError(null);
        createCameraModal.openModal();
    }

    function closeCreateCameraModal() {
        createCameraModal.closeModal();
        setCameraName("");
        setCreateCameraError(null);
    }

    function openCameraSecretModal(cameraId: string, secret: string) {
        setCreatedCameraId(cameraId);
        setCreatedCameraSecret(secret);
        cameraSecretModal.openModal();
    }

    function closeCameraSecretModal() {
        cameraSecretModal.closeModal();
        setCreatedCameraId(null);
        setCreatedCameraSecret(null);
    }

    async function copyCameraSecretToClipboard() {
        const secret = createdCameraSecret;
        if (!secret) return;

        try {
            await navigator.clipboard.writeText(secret);
            notify({
                variant: "success",
                title: "Copied",
                message: "Camera secret copied to clipboard.",
            });
        } catch {
            notify({
                variant: "error",
                title: "Copy failed",
                message: "Couldn't copy to clipboard. Please copy it manually.",
            });
        }
    }

    function openEditBranchModal() {
        if (!canEdit) return;
        setRenameError(null);
        setBranchName(branch?.name ?? "");
        editBranchModal.openModal();
    }

    function closeEditBranchModal() {
        editBranchModal.closeModal();
        setRenameError(null);
        setBranchName("");
    }

    async function onRenameBranchSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canEdit) return;

        if (!id || !branch) {
            setRenameError("Missing branch id.");
            return;
        }

        const name = branchName.trim();
        if (!name) {
            setRenameError("Branch name is required.");
            return;
        }

        const group_id = editUserGroupId ?? branch.group_id;
        if (!group_id) {
            setRenameError("Missing group id for this user.");
            return;
        }

        if (name === branch.name) {
            closeEditBranchModal();
            return;
        }

        setIsRenaming(true);
        setRenameError(null);
        try {
            const updated = (await updateBranch(id, { name, group_id })) as Branch | null;

            // updateBranch() returns data.data in libs/actions.ts.
            setBranch((prev) => (prev ? { ...prev, ...(updated ?? {}), name } : prev));

            closeEditBranchModal();
            notify({
                variant: "success",
                title: "Branch updated",
                message: `Branch renamed to “${name}”.`,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to rename branch.";
            setRenameError(message);
        } finally {
            setIsRenaming(false);
        }
    }

    async function onCreateSensorSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canEdit) return;

        const name = sensorName.trim();
        if (!id) {
            setCreateSensorError("Missing branch id.");
            return;
        }
        if (!name) {
            setCreateSensorError("Sensor name is required.");
            return;
        }

        setIsCreatingSensor(true);
        setCreateSensorError(null);
        try {
            const created = (await createSensor({ name, branch_id: id })) as any;
            await refreshSensors();
            closeCreateSensorModal();

            notify({
                variant: "success",
                title: "Sensor created",
                message: `“${name}” was created successfully.`,
            });

            const createdSensorId: string | undefined = created?.sensor_id;
            if (createdSensorId) {
                router.push(`/sensors/${encodeURIComponent(createdSensorId)}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create sensor.";
            setCreateSensorError(message);
        } finally {
            setIsCreatingSensor(false);
        }
    }

    async function onCreateCameraSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canEdit) return;

        const name = cameraName.trim();
        if (!id) {
            setCreateCameraError("Missing branch id.");
            return;
        }
        if (!name) {
            setCreateCameraError("Camera name is required.");
            return;
        }

        setIsCreatingCamera(true);
        setCreateCameraError(null);
        try {
            const created = await createCamera({ name, branch_id: id });
            await refreshCameras();
            closeCreateCameraModal();

            notify({
                variant: "success",
                title: "Camera created",
                message: `“${name}” was created successfully.`,
            });

            // Show the secret immediately so the user can copy it.
            if (created?.camera_id && created?.secret) {
                openCameraSecretModal(created.camera_id, created.secret);
            } else if (created?.camera_id) {
                // Fallback if API didn't include secret for some reason.
                router.push(`/cameras/${encodeURIComponent(created.camera_id)}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create camera.";
            setCreateCameraError(message);
        } finally {
            setIsCreatingCamera(false);
        }
    }

    async function onDelete() {
        if (!canEdit) return;

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
                        <div className="flex items-center gap-1">
                            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                                {branch.name}
                            </h1>
                            {(() => {
                                const b = deriveAlertBadge("");  // will update to use real alert data when implemented
                                return (
                                    <span title={b.title} className="inline-flex whitespace-nowrap">
                                        <Badge color={b.color} variant={b.variant} size="sm">
                                            {b.label}
                                        </Badge>
                                    </span>
                                );
                            })()}
                            {canEdit ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={openEditBranchModal}
                                    className="h-8 w-8 px-0 py-0 bg-none !bg-transparent !ring-0 !ring-transparent shadow-none hover:ring-0"
                                    startIcon={<PencilIcon/>}
                                >
                                    <span className="sr-only">Edit</span>
                                </Button>
                            ) : null}
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Branch ID: <span className="font-mono">{branch.branch_id}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="ring-orange-600 bg-orange-100"
                                    onClick={onDelete}
                                    disabled={isDeleting}
                                >
                                    <TrashBinIcon/>
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="mt-6 space-y-6">
                    <ComponentCard
                        title="Devices"
                        desc={(camerasLoading || sensorsLoading) ? "Loading devices…" : ""}
                    >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-800 dark:text-white/90">Camera</div>
                                    {canEdit ? (
                                        <span
                                            title={disableAddCamera ? "This branch already has a camera." : undefined}
                                            className="inline-flex"
                                        >
                                             <Button
                                                 size="sm"
                                                 variant="outline"
                                                 onClick={openCreateCameraModal}
                                                 disabled={disableAddCamera}
                                             >
                                                 Add camera
                                             </Button>
                                         </span>
                                    ) : null}
                                </div>

                                {camerasError ? (
                                    <div
                                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                        {camerasError}
                                    </div>
                                ) : null}

                                {!camerasLoading && !camerasError && cameras.length === 0 ? (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        No camera attached to this branch.
                                    </div>
                                ) : null}

                                {camerasLoading ? (
                                    <div
                                        className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"/>
                                ) : null}

                                {!camerasLoading && !camerasError && cameras.length > 0 ? (
                                    (() => {
                                        const c = cameras[0] as (typeof cameras)[number];
                                        return (
                                            <button
                                                key={c.camera_id}
                                                type="button"
                                                onClick={() => router.push(`/cameras/${encodeURIComponent(c.camera_id)}`)}
                                                className="group w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-theme-xs transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-900/60"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div
                                                            className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900 dark:text-white/90 dark:group-hover:text-white">
                                                            {c.name || c.camera_id}&nbsp;
                                                            <SensorStatusBadge
                                                                status={cameraStatuses[c.camera_id] ?? "unknown"}/>
                                                        </div>
                                                        <div
                                                            className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                            Camera ID: <span className="font-mono">{c.camera_id}</span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="text-xs text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400">
                                                        View
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })()
                                ) : null}
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-800 dark:text-white/90">Sensor</div>
                                    {canEdit ? (
                                        <span
                                            title={disableAddSensor ? "This branch already has a sensor." : undefined}
                                            className="inline-flex"
                                        >
                                             <Button
                                                 size="sm"
                                                 variant="outline"
                                                 onClick={openCreateSensorModal}
                                                 disabled={disableAddSensor}
                                             >
                                                 Add sensor
                                             </Button>
                                         </span>
                                    ) : null}
                                </div>

                                {sensorsError ? (
                                    <div
                                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                        {sensorsError}
                                    </div>
                                ) : null}

                                {!sensorsLoading && !sensorsError && sensors.length === 0 ? (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        No sensor found for this branch.
                                    </div>
                                ) : null}

                                {sensorsLoading ? (
                                    <div
                                        className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"/>
                                ) : null}

                                {!sensorsLoading && !sensorsError && sensors.length > 0 ? (
                                    (() => {
                                        const s = sensors[0] as Sensor;
                                        return (
                                            <button
                                                key={s.sensor_id}
                                                type="button"
                                                onClick={() => router.push(`/sensors/${encodeURIComponent(s.sensor_id)}`)}
                                                className="group w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-theme-xs transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-900/60"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div
                                                            className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900 dark:text-white/90 dark:group-hover:text-white">
                                                            {s.name}&nbsp;
                                                            <SensorStatusBadge status={(s as any)?.status}/>
                                                        </div>
                                                        <div
                                                            className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                            Sensor ID: <span className="font-mono">{s.sensor_id}</span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="text-xs text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400">
                                                        View
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })()
                                ) : null}
                            </div>
                        </div>
                    </ComponentCard>

                    <ComponentCard
                        title="Prediction"
                        desc={predictionLoading ? "Loading prediction…" : ""}
                    >
                        {predictionError ? (
                            <div
                                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                {predictionError}
                            </div>
                        ) : null}

                        {!predictionLoading && !predictionError && !prediction ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                No prediction available for this branch.
                            </div>
                        ) : null}

                        {!predictionLoading && !predictionError && prediction ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div
                                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Model</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                                            {prediction.model_id}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Version: <span className="font-mono">{prediction.model_version}</span>
                                        </div>
                                    </div>
                                    <div
                                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Window</div>
                                        <div className="mt-1 text-sm text-gray-800 dark:text-white/90">
                                            Next {prediction.horizon} minutes, step ahead {prediction.step_ahead} minute
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const pred = prediction.predictions;

                                    const co2Vals: number[] | undefined = Array.isArray(pred?.co2)
                                        ? pred.co2
                                        : undefined;
                                    const tempVals: number[] | undefined = Array.isArray(pred?.temp)
                                        ? pred.temp
                                        : undefined;
                                    const rhVals: number[] | undefined = Array.isArray(pred?.rh)
                                        ? pred.rh
                                        : undefined;

                                    const co2 = co2Vals?.at(-1);
                                    const temp = tempVals?.at(-1);
                                    const rh = rhVals?.at(-1);

                                    const fmt = (v: unknown) =>
                                        typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—";

                                    return (
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div
                                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Next CO₂</div>
                                                <div className="mt-1 flex items-center justify-between gap-3">
                                                    <div
                                                        className="text-lg font-semibold text-gray-800 dark:text-white/90">
                                                        {fmt(co2)} <span
                                                        className="text-xs text-gray-500 dark:text-gray-400">ppm</span>
                                                    </div>
                                                    <PredictionSparkline values={co2Vals} color="#F97316" decimals={0}/>
                                                </div>
                                            </div>
                                            <div
                                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Next Temp
                                                </div>
                                                <div className="mt-1 flex items-center justify-between gap-3">
                                                    <div
                                                        className="text-lg font-semibold text-gray-800 dark:text-white/90">
                                                        {fmt(temp)} <span
                                                        className="text-xs text-gray-500 dark:text-gray-400">°C</span>
                                                    </div>
                                                    <PredictionSparkline values={tempVals} color="#465FFF"
                                                                         decimals={1}/>
                                                </div>
                                            </div>
                                            <div
                                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Next RH</div>
                                                <div className="mt-1 flex items-center justify-between gap-3">
                                                    <div
                                                        className="text-lg font-semibold text-gray-800 dark:text-white/90">
                                                        {fmt(rh)} <span
                                                        className="text-xs text-gray-500 dark:text-gray-400">%</span>
                                                    </div>
                                                    <PredictionSparkline values={rhVals} color="#22C55E" decimals={1}/>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : null}
                    </ComponentCard>

                    <ComponentCard
                        title="Alerts"
                        desc={alertsLoading ? "Loading alerts…" : ""}
                    >
                        {alertsError ? (
                            <div
                                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                {alertsError}
                            </div>
                        ) : null}

                        {!alertsLoading && !alertsError && alerts.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                No alerts for this branch.
                            </div>
                        ) : null}

                        <div className="space-y-4">
                            {(alertsLoading ? Array.from({ length: 4 }) as Alert[] : alerts).map((alert, idx) => {
                                if (alertsLoading) {
                                    return (
                                        <div
                                            key={`alert-skeleton-${idx}`}
                                            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                                        />
                                    );
                                }

                                return (
                                    <div
                                        key={alert.alert_id}
                                        id={`alert-${alert.alert_id}`}
                                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-in-out hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(alert.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {alert.message}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex">
                                                <Badge
                                                    color={alert.is_read ? "light" : "warning"}
                                                    variant={alert.is_read ? "light" : "solid"}
                                                    size="sm"
                                                >
                                                    {alert.is_read ? "Read" : "Unread"}
                                                </Badge>
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAlertMarkRead(alert)}
                                                disabled={alert.is_read}
                                            >
                                                {alert.is_read ? "Marked as read" : "Mark as read"}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ComponentCard>
                </div>
            </div>

            {canEdit ? (
                <>
                    <Modal
                        isOpen={createCameraModal.isOpen}
                        onClose={closeCreateCameraModal}
                        className="max-w-[584px] p-5 lg:p-8"
                    >
                        <form onSubmit={onCreateCameraSubmit}>
                            <h4 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                                Create camera
                            </h4>

                            <div className="grid grid-cols-1 gap-y-3">
                                <div>
                                    <Label htmlFor="camera-name">Camera name</Label>
                                    <Input
                                        id="camera-name"
                                        name="name"
                                        type="text"
                                        placeholder="e.g. Entrance"
                                        defaultValue={cameraName}
                                        onChange={(e) => setCameraName(e.target.value)}
                                        error={Boolean(createCameraError)}
                                        hint={createCameraError ?? undefined}
                                        disabled={isCreatingCamera}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={closeCreateCameraModal}
                                    disabled={isCreatingCamera}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" type="submit" disabled={isCreatingCamera}>
                                    {isCreatingCamera ? "Creating..." : "Create"}
                                </Button>
                            </div>
                        </form>
                    </Modal>

                    <Modal
                        isOpen={createSensorModal.isOpen}
                        onClose={closeCreateSensorModal}
                        className="max-w-[584px] p-5 lg:p-8"
                    >
                        <form onSubmit={onCreateSensorSubmit}>
                            <h4 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                                Create sensor
                            </h4>

                            <div className="grid grid-cols-1 gap-y-3">
                                <div>
                                    <Label htmlFor="sensor-name">Sensor name</Label>
                                    <Input
                                        id="sensor-name"
                                        name="name"
                                        type="text"
                                        placeholder="e.g. Room 101"
                                        defaultValue={sensorName}
                                        onChange={(e) => setSensorName(e.target.value)}
                                        error={Boolean(createSensorError)}
                                        hint={createSensorError ?? undefined}
                                        disabled={isCreatingSensor}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={closeCreateSensorModal}
                                    disabled={isCreatingSensor}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" type="submit" disabled={isCreatingSensor}>
                                    {isCreatingSensor ? "Creating..." : "Create"}
                                </Button>
                            </div>
                        </form>
                    </Modal>

                    <Modal
                        isOpen={editBranchModal.isOpen}
                        onClose={closeEditBranchModal}
                        className="max-w-[584px] p-5 lg:p-8"
                    >
                        <form onSubmit={onRenameBranchSubmit}>
                            <h4 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                                Edit branch name
                            </h4>

                            <div className="grid grid-cols-1 gap-y-3">
                                <div>
                                    <Label htmlFor="branch-name">Branch name</Label>
                                    <Input
                                        id="branch-name"
                                        name="name"
                                        type="text"
                                        placeholder="e.g. Main campus"
                                        defaultValue={branchName}
                                        onChange={(e) => setBranchName(e.target.value)}
                                        error={Boolean(renameError)}
                                        hint={renameError ?? undefined}
                                        disabled={isRenaming}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={closeEditBranchModal}
                                    disabled={isRenaming}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" type="submit" disabled={isRenaming}>
                                    {isRenaming ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        </form>
                    </Modal>

                    <Modal
                        isOpen={cameraSecretModal.isOpen}
                        onClose={closeCameraSecretModal}
                        className="max-w-[584px] p-5 lg:p-8"
                    >
                        <div>
                            <h4 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                                Camera secret
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Copy and save this secret now. For security reasons, it may not be shown again.
                            </p>

                            <div
                                className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Secret</div>
                                <div className="mt-1 break-all font-mono text-sm text-gray-800 dark:text-white/90">
                                    {createdCameraSecret ?? ""}
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                                <Button size="sm" variant="outline" onClick={closeCameraSecretModal}>
                                    Close
                                </Button>
                                <Button size="sm" variant="outline" onClick={copyCameraSecretToClipboard}>
                                    Copy
                                </Button>
                                {createdCameraId ? (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            const cid = createdCameraId;
                                            closeCameraSecretModal();
                                            router.push(`/cameras/${encodeURIComponent(cid)}`);
                                        }}
                                    >
                                        Go to camera
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </Modal>
                </>
            ) : null}
        </div>
    );
}

