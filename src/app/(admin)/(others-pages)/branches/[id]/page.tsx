"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    createCamera,
    createSensor,
    deleteBranch,
    getBranch,
    getBranchCameras,
    getBranchSensors,
    Sensor,
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

    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [sensorsLoading, setSensorsLoading] = useState(false);
    const [sensorsError, setSensorsError] = useState<string | null>(null);

    const [cameras, setCameras] = useState<
        {
            camera_id: string;
            branch_id: string;
            name: string;
            updated_at: string;
        }[]
    >([]);
    const [camerasLoading, setCamerasLoading] = useState(false);
    const [camerasError, setCamerasError] = useState<string | null>(null);

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

    function openCreateSensorModal() {
        if (!canEdit) return;
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
                                const b = deriveAlertBadge(branch.alert);
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
                                <span
                                    title={
                                        disableAddCamera
                                            ? "This branch already has a camera."
                                            : undefined
                                    }
                                    className="inline-flex"
                                >
                                    <Button
                                        size="sm"
                                        onClick={openCreateCameraModal}
                                        disabled={disableAddCamera}
                                    >
                                        Add camera
                                    </Button>
                                </span>
                                <Button size="sm" onClick={openCreateSensorModal}>
                                    Add sensor
                                </Button>
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

                {/* Alerts badge moved to header for compact display */}

                <div className="mt-6 space-y-6">
                    <ComponentCard
                        title={cameras.length === 1 ? "Camera" : "Cameras"}
                        desc={
                            camerasLoading
                                ? "Loading cameras…" : ""
                        }
                    >
                        {camerasError ? (
                            <div
                                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                {camerasError}
                            </div>
                        ) : null}

                        {!camerasLoading && !camerasError && cameras.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                No cameras attached to this branch.
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {(camerasLoading ? Array.from({ length: 4 }) : cameras).map((camera, idx) => {
                                if (camerasLoading) {
                                    return (
                                        <div
                                            key={`camera-skeleton-${idx}`}
                                            className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                                        />
                                    );
                                }

                                const c = camera as (typeof cameras)[number];

                                return (
                                    <button
                                        key={c.camera_id}
                                        type="button"
                                        onClick={() => router.push(`/cameras/${encodeURIComponent(c.camera_id)}`)}
                                        className="group w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-theme-xs transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-900/60"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div
                                                    className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900 dark:text-white/90 dark:group-hover:text-white">
                                                    {c.name || c.camera_id}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                            })}
                        </div>
                    </ComponentCard>

                    <ComponentCard
                        title={sensors.length === 1 ? "Sensor" : "Sensors"}
                        desc={
                            sensorsLoading
                                ? "Loading sensors…"
                                : `${sensors.length} sensor${sensors.length === 1 ? "" : "s"} in this branch.`
                        }
                    >
                        {sensorsError ? (
                            <div
                                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                                {sensorsError}
                            </div>
                        ) : null}

                        {!sensorsLoading && !sensorsError && sensors.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                No sensors found for this branch.
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {(sensorsLoading ? Array.from({ length: 4 }) : sensors).map(
                                (sensor, idx) => {
                                    if (sensorsLoading) {
                                        return (
                                            <div
                                                key={`skeleton-${idx}`}
                                                className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                                            />
                                        );
                                    }

                                    const s = sensor as Sensor;

                                    return (
                                        <button
                                            key={s.sensor_id}
                                            type="button"
                                            onClick={() => router.push(`/sensors/${encodeURIComponent(s.sensor_id)}`)}
                                            className="group w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-theme-xs transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-900/60"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div
                                                        className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900 dark:text-white/90 dark:group-hover:text-white">
                                                        {s.name}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                                },
                            )}
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

