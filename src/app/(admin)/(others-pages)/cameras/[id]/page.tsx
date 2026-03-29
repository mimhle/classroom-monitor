"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import HlsPlayer from "@/components/cameras/HlsPlayer";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import { getCurrentUser } from "@/libs/auth";
import { isAdminOrSuperadmin } from "@/libs/roles";
import {
    type Camera,
    deleteCamera,
    getCamera,
    getCameraStatus,
    getCameraUrl,
    resetCameraSecret,
    updateCamera,
} from "@/libs/actions";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import SensorStatusBadge from "@/components/common/SensorStatusBadge";

type CameraUrlResponse = {
    access_token?: string;
    stream_url?: string;
    expires_at?: string;
};

export default function CameraPage() {
    const params = useParams<{ id: string }>();
    const cameraId = params?.id;
    const router = useRouter();
    const { notify } = useNotification();

    const [camera, setCamera] = useState<Camera | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamLoading, setStreamLoading] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    const [canEdit, setCanEdit] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isResettingSecret, setIsResettingSecret] = useState(false);

    const editCameraModal = useModal(false);
    const [cameraName, setCameraName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const cameraSecretModal = useModal(false);
    const [createdCameraSecret, setCreatedCameraSecret] = useState<string | null>(null);

    const [cameraStatus, setCameraStatus] = useState<"online" | "offline" | "unknown">("unknown");

    useEffect(() => {
        let cancelled = false;
        getCurrentUser()
            .then((user) => {
                if (cancelled) return;
                setCanEdit(isAdminOrSuperadmin(user));
            })
            .catch(() => {
                if (cancelled) return;
                setCanEdit(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!cameraId) return;

            setLoading(true);
            setError(null);
            try {
                const data = (await getCamera(cameraId)) as Camera;
                if (cancelled) return;
                setCamera(data);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load camera.";
                setError(msg);
                setCamera(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [cameraId]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!cameraId) return;

            setStreamLoading(true);
            setStreamError(null);
            setStreamUrl(null);
            try {
                const data = (await getCameraUrl(cameraId)) as any;

                // actions.ts currently returns data.data.url; normalize a couple common shapes.
                const normalized: CameraUrlResponse | null =
                    data && typeof data === "object" && ("stream_url" in data || "access_token" in data || "expires_at" in data)
                        ? (data as CameraUrlResponse)
                        : data && typeof data === "object" && "url" in data
                            ? (data.url as CameraUrlResponse)
                            : null;

                const url = normalized?.stream_url ?? (typeof data === "string" ? data : null);

                if (!url) {
                    if (cancelled) return;
                    setStreamError("Camera stream URL was not returned by the server.");
                    setStreamUrl(null);
                    return;
                }

                if (cancelled) return;
                setStreamUrl(url);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : "Failed to load camera stream.";
                setStreamError(msg);
                setStreamUrl(null);
            } finally {
                if (!cancelled) setStreamLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [cameraId]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!cameraId) return;

            try {
                const res = await getCameraStatus(cameraId);
                if (cancelled) return;
                setCameraStatus(res?.status ?? "unknown");
            } catch {
                if (cancelled) return;
                setCameraStatus("unknown");
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [cameraId]);

    useEffect(() => {
        if (!cameraId) return;

        let cancelled = false;
        const interval = window.setInterval(() => {
            if (cancelled) return;
            if (document.visibilityState === "hidden") return;
            void (async () => {
                try {
                    const res = await getCameraStatus(cameraId);
                    if (!cancelled) setCameraStatus(res?.status ?? "unknown");
                } catch {
                    // keep last known state
                }
            })();
        }, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [cameraId]);

    function closeCameraSecretModal() {
        cameraSecretModal.closeModal();
        setCreatedCameraSecret(null);
    }

    function openEditCameraModal() {
        if (!canEdit) return;
        setSaveError(null);
        setCameraName(camera?.name ?? "");
        editCameraModal.openModal();
    }

    function closeEditCameraModal() {
        editCameraModal.closeModal();
        setSaveError(null);
        setCameraName("");
    }

    async function onEditCameraSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canEdit) return;

        if (!cameraId || !camera) {
            setSaveError("Missing camera id.");
            return;
        }

        const name = cameraName.trim();
        if (!name) {
            setSaveError("Camera name is required.");
            return;
        }

        if (name === camera.name) {
            closeEditCameraModal();
            return;
        }

        const branch_id = camera.branch_id;

        setIsSaving(true);
        setSaveError(null);
        try {
            const updated = (await updateCamera(cameraId, { name, branch_id })) as any;
            setCamera((prev) => (prev ? { ...prev, ...(updated ?? {}), name } : prev));
            closeEditCameraModal();
            notify({
                variant: "success",
                title: "Camera updated",
                message: `Camera renamed to “${name}”.`,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update camera.";
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
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

    async function onResetSecret() {
        if (!canEdit) return;
        if (!cameraId) {
            notify({ variant: "error", title: "Reset failed", message: "Missing camera id." });
            return;
        }

        const ok = window.confirm(
            "Reset this camera secret? Any clients using the old secret will stop working.",
        );
        if (!ok) return;

        setIsResettingSecret(true);
        try {
            const res = await resetCameraSecret(cameraId);

            if (res?.secret) {
                setCreatedCameraSecret(res.secret);
                cameraSecretModal.openModal();
            }

            notify({
                variant: "success",
                title: "Secret reset",
                message: "A new camera secret was generated.",
            });

            // Refresh camera info (e.g., updated_at)
            try {
                const data = (await getCamera(cameraId)) as Camera;
                setCamera(data);
            } catch {
                // ignore; secret is already shown
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to reset camera secret.";
            notify({ variant: "error", title: "Reset failed", message: msg });
        } finally {
            setIsResettingSecret(false);
        }
    }

    async function onDelete() {
        if (!canEdit) return;

        if (!cameraId || !camera) {
            notify({
                variant: "error",
                title: "Delete failed",
                message: "Missing camera id.",
            });
            return;
        }

        const ok = window.confirm(
            `Delete camera “${camera.name ?? camera.camera_id}” (${camera.camera_id})? This can’t be undone.`,
        );
        if (!ok) return;

        setIsDeleting(true);
        try {
            await deleteCamera(cameraId);
            notify({
                variant: "success",
                title: "Camera deleted",
                message: `“${camera.name ?? camera.camera_id}” was deleted successfully.`,
            });

            // Prefer going back to branch details (if known), else back.
            if (camera.branch_id) {
                router.replace(`/branches/${encodeURIComponent(camera.branch_id)}`);
            } else {
                router.back();
            }
            router.refresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete camera.";
            notify({ variant: "error", title: "Delete failed", message: msg });
        } finally {
            setIsDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-5xl">
                    <div
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-5xl">
                    <div
                        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        {error}
                    </div>
                    <button
                        className="mt-4 text-sm text-gray-600 underline dark:text-gray-300"
                        onClick={() => router.back()}
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    if (!camera) return null;

    return (
        <div className="p-8">
            <div className="mx-auto w-full max-w-5xl flex flex-col gap-6">
                <div className="mb-1 flex flex-row justify-between">
                    <div>
                        <div className="flex items-center gap-1">
                            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                                {camera?.name ?? "Camera"}
                            </h1>
                            <SensorStatusBadge status={cameraStatus}/>
                            {canEdit ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={openEditCameraModal}
                                    disabled={isDeleting || isResettingSecret || isSaving}
                                    className="h-8 w-8 px-0 py-0 bg-none !bg-transparent !ring-0 !ring-transparent shadow-none hover:ring-0"
                                    startIcon={<PencilIcon/>}
                                >
                                    <span className="sr-only">Edit</span>
                                </Button>
                            ) : null}
                        </div>
                        <div
                            className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>
                                Camera ID: <span className="font-mono">{camera?.camera_id}</span>
                            </span>
                            {camera?.branch_id ? (
                                <Badge color="light" variant="light">
                                    Branch: {camera.branch_id}
                                </Badge>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {canEdit ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onResetSecret}
                                    disabled={isResettingSecret || isDeleting || isSaving}
                                >
                                    {isResettingSecret ? "Resetting…" : "Reset secret"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="ring-orange-600 bg-orange-100"
                                    onClick={onDelete}
                                    disabled={isDeleting || isResettingSecret || isSaving}
                                >
                                    <TrashBinIcon/>
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                {canEdit ? (
                    <Modal
                        isOpen={editCameraModal.isOpen}
                        onClose={closeEditCameraModal}
                        className="max-w-[700px] p-6 lg:p-10"
                    >
                        <form onSubmit={onEditCameraSubmit} className="space-y-6">
                            <div>
                                <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                                    Edit camera
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Update this camera’s display name.
                                </p>
                            </div>

                            <div>
                                <Label>Camera name</Label>
                                <Input
                                    defaultValue={cameraName}
                                    onChange={(e) => setCameraName(e.target.value)}
                                    placeholder="Enter camera name"
                                />
                            </div>

                            {saveError ? (
                                <div className="text-sm text-red-600 dark:text-red-400">{saveError}</div>
                            ) : null}

                            <div className="flex items-center justify-end gap-3">
                                <Button variant="outline" type="button" onClick={closeEditCameraModal}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Saving…" : "Save"}
                                </Button>
                            </div>
                        </form>
                    </Modal>
                ) : null}

                <ComponentCard title="Live stream">
                    {streamLoading ? (
                        <div className="text-sm text-gray-500">Requesting access token…</div>
                    ) : streamError ? (
                        <div className="text-sm text-red-600">{streamError}</div>
                    ) : streamUrl ? (
                        <div className="overflow-visible flex flex-row justify-center">
                            <HlsPlayer src={streamUrl} className="max-h-[70dvh] w-fit"/>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500">No stream available.</div>
                    )}
                </ComponentCard>

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
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}
