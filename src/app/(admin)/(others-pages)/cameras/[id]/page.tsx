"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import HlsPlayer from "@/components/cameras/HlsPlayer";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { TrashBinIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import { getCurrentUser } from "@/libs/auth";
import { isAdminOrSuperadmin } from "@/libs/roles";
import { deleteCamera, getCamera, getCameraUrl, resetCameraSecret } from "@/libs/actions";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";

type Camera = {
    camera_id: string;
    branch_id: string;
    name: string;
    updated_at: string;
};

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

    const cameraSecretModal = useModal(false);
    const [createdCameraSecret, setCreatedCameraSecret] = useState<string | null>(null);

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

    const backHref = useMemo(() => {
        if (camera?.branch_id) return `/branches/${encodeURIComponent(camera.branch_id)}`;
        return "/branches";
    }, [camera?.branch_id]);

    function closeCameraSecretModal() {
        cameraSecretModal.closeModal();
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
            <div className="space-y-6">
                <ComponentCard title="Camera">
                    <div className="text-sm text-gray-500">Loading…</div>
                </ComponentCard>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <ComponentCard title="Camera">
                    <div className="text-sm text-red-600">{error}</div>
                </ComponentCard>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ComponentCard title={`${camera?.name ?? "Camera"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-xs text-gray-500">Camera ID</div>
                        <div className="truncate text-sm font-medium text-gray-900">{camera?.camera_id}</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href={backHref} className="text-sm text-brand-600 hover:underline">
                            Back to cameras
                        </Link>
                        {camera?.branch_id ? (
                            <Badge color="light" variant="light">
                                Branch: {camera.branch_id}
                            </Badge>
                        ) : null}

                        {canEdit ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onResetSecret}
                                    disabled={isResettingSecret || isDeleting}
                                >
                                    {isResettingSecret ? "Resetting…" : "Reset secret"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="ring-orange-600 bg-orange-100"
                                    onClick={onDelete}
                                    disabled={isDeleting || isResettingSecret}
                                >
                                    <TrashBinIcon/>
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            </ComponentCard>

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
    );
}
