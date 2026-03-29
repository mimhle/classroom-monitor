"use client";

import { emitBranchesChanged } from "@/libs/branchEvents";

export type SensorField = "co2" | "temp" | "rh" | "vbat" | "lux" | "mic" | "pm2_5" | "pm10";

export type SensorThresholds = {
    min: number;
    max: number;
    activated: boolean;
};

export type Branch = {
    branch_id: string;
    group_id?: string;
    name: string;
    thresholds: {
        activate: boolean;
        sensors: Record<SensorField, SensorThresholds>;
    }
};

export type Camera = {
    camera_id: string;
    branch_id: string;
    name: string;
    secret: string;
    updated_at: string;
};

export async function getBranches() {
    return fetch(`/api/branches`, {
        method: "GET",
        cache: "no-store",
    }).then((res) => {
        if (!res.ok) {
            throw new Error(`Failed to fetch branches: ${res.statusText}`);
        }
        return res.json();
    });
}

export type CreateBranchInput = {
    name: string;
    group_id?: string;
    thresholds?: {
        activate: boolean;
        sensors: Record<SensorField, SensorThresholds>;
    };
};

export async function createBranch(input: CreateBranchInput) {
    return fetch(`/api/branches`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }

        const json = await res.json();
        emitBranchesChanged();
        return json;
    });
}

export async function getBranch(id: string): Promise<Branch> {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            if ("thresholds" in data.data && typeof data.data.thresholds === "string") {
                try {
                    data.data.thresholds = JSON.parse(data.data.thresholds);
                } catch (e) {
                    console.warn("Failed to parse thresholds for branch", id, data.data.thresholds, e);
                    data.data.thresholds = {
                        activate: false,
                        sensors: {},
                    };
                }
            }
            return data.data;
        });
    });
}

export async function deleteBranch(id: string) {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }

        emitBranchesChanged();
    });
}

export async function updateBranch(id: string, input: CreateBranchInput) {
    return fetch(`/api/branches/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update branch: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            emitBranchesChanged();
            return data.data;
        });
    });
}

export type AlertLevel = "WARNING" | "CRITICAL";

export type Alert = {
    alert_id: string;
    branch_id: string;
    level: AlertLevel;
    message: string;
    created_at: string;
    is_read: boolean;
};

/**
 * Fetch a cross-branch alerts feed.
 *
 * There is no single "get all alerts" endpoint, so we aggregate by:
 * 1) fetching branches
 * 2) fetching alerts for each branch
 */
export async function getAlertsFeed(options?: {
    limit?: number;
    includeRead?: boolean;
    signal?: AbortSignal;
}): Promise<Alert[]> {
    const limit = options?.limit ?? 10;
    const includeRead = options?.includeRead ?? true;

    const branchesRes = await getBranches();
    const branches: Branch[] = Array.isArray((branchesRes as any)?.data)
        ? ((branchesRes as any).data as Branch[])
        : Array.isArray(branchesRes)
            ? (branchesRes as Branch[])
            : Array.isArray((branchesRes as any)?.items)
                ? ((branchesRes as any).items as Branch[])
                : [];

    if (branches.length === 0) return [];

    // Pull a small slice from each branch so the feed isn't dominated by one branch.
    const perBranchLimit = Math.max(1, Math.ceil(limit / Math.max(1, branches.length)));

    const alerts: Alert[] = [];

    // Small concurrency-by-chunk to avoid spamming the API.
    const chunkSize = 6;
    for (let i = 0; i < branches.length; i += chunkSize) {
        if (options?.signal?.aborted) break;

        const chunk = branches.slice(i, i + chunkSize);
        const results = await Promise.all(
            chunk.map(async (b) => {
                try {
                    if (options?.signal?.aborted) return [];

                    const items = await getBranchAlerts(b.branch_id);
                    const sliced = Array.isArray(items) ? items.slice(0, perBranchLimit) : [];
                    return includeRead ? sliced : sliced.filter((a) => !a.is_read);
                } catch {
                    return [];
                }
            }),
        );

        for (const arr of results) alerts.push(...(arr as Alert[]));
    }

    // Sort desc by time, then trim to limit.
    alerts.sort((a, b) => {
        const at = Date.parse(a.created_at ?? "") || 0;
        const bt = Date.parse(b.created_at ?? "") || 0;
        return bt - at;
    });

    return alerts.slice(0, limit);
}

export async function getBranchAlerts(branchId: string): Promise<Alert[]> {
    return fetch(`/api/branches/${encodeURIComponent(branchId)}/alerts`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch branch alerts: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""
                }`,
            );
        }
        return res.json().then((data) => {
            return data.data as Alert[];
        });
    });
}

export async function markAlertAsRead(branchId: string, alertId: string) {
    return fetch(`/api/branches/${encodeURIComponent(branchId)}/alerts/${encodeURIComponent(alertId)}/read`, {
        method: "POST",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to mark alert as read: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export async function getUsers() {
    return fetch(`/api/users`, {
        method: "GET",
        cache: "no-store",
    }).then((res) => {
        if (!res.ok) {
            throw new Error(`Failed to fetch users: ${res.statusText}`);
        }
        return res.json();
    });
}

export async function getUser(id: string) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type CreateUserInput = {
    username: string;
    password?: string;
    role?: "User" | "Admin";
    group_id?: string;
};

export async function createUser(input: CreateUserInput) {
    return fetch(`/api/users`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function deleteUser(id: string) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete user: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export async function updateUser(id: string, input: CreateUserInput) {
    return fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update user: ${res.status
                } ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type Sensor = {
    sensor_id: string;
    branch_id: string;
    name: string;
    status: "online" | "offline";
    updated_at: string;
};

export async function getBranchSensors(branchId: string): Promise<{
    count: number;
    items: Sensor[];
}> {
    return fetch(`/api/branches/${encodeURIComponent(branchId)}/sensors`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch branch sensors: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""
                }`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getSensor(id: string): Promise<Sensor> {
    return fetch(`/api/sensors/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch sensor: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function deleteSensor(id: string) {
    return fetch(`/api/sensors/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete sensor: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export type SensorData = {
    sensor: string;
    count: number;
    items: Record<"value" | "created_at", string>[];
};

export async function getSensorData(
    sensorId: string,
    limit: number = 100,
    from: string | null = null,
    to: string | null = null,
) {
    return fetch(`/api/sensors/${encodeURIComponent(sensorId)}/values?limit=${limit}${from ? `&from_time=${encodeURIComponent(from)}` : ""}${to ? `&to_time=${encodeURIComponent(to)}` : ""}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch sensor data: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""
                }`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type CreateSensorInput = {
    name: string;
    branch_id: string;
};

export async function createSensor(input: CreateSensorInput) {
    return fetch(`/api/sensors`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create sensor: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function updateSensor(id: string, input: CreateSensorInput) {
    return fetch(`/api/sensors/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update sensor: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getBranchCameras(branchId: string): Promise<{
    count: number;
    items: Camera[];
}> {
    return fetch(`/api/branches/${encodeURIComponent(branchId)}/cameras`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch branch cameras: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""
                }`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getCamera(id: string): Promise<Camera> {
    return fetch(`/api/cameras/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch camera: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function deleteCamera(id: string) {
    return fetch(`/api/cameras/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete camera: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export type CreateCameraInput = {
    name: string;
    branch_id: string;
};

export async function createCamera(input: CreateCameraInput): Promise<{
    camera_id: string;
    branch_id: string;
    name: string;
    secret: string;
    created_at: string;
}> {
    return fetch(`/api/cameras`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create camera: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function updateCamera(id: string, input: CreateCameraInput) {
    return fetch(`/api/cameras/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update camera: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getCameraUrl(cameraId: string): Promise<{
    access_token: string;
    stream_url: string;
    expires_at: string;
}> {
    return fetch(`/api/cameras/request-access?camera_id=${encodeURIComponent(cameraId)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch camera URL: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function resetCameraSecret(cameraId: string): Promise<{
    camera_id: string;
    branch_id: string;
    name: string;
    secret: string;
    updated_at: string;
}> {
    return fetch(`/api/cameras/${encodeURIComponent(cameraId)}/reset-secret`, {
        method: "POST",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to reset camera secret: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export async function getCameraStatus(cameraId: string): Promise<{
    camera_id: string;
    status: "online" | "offline";
}> {
    return fetch(`/api/cameras/${encodeURIComponent(cameraId)}/status`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch camera status: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type PredictionMetric = "co2" | "temp" | "rh";
export type BranchPrediction = {
    model_id: string;
    model_version: string;
    horizon: number;
    step_ahead: number;
    predictions: Record<PredictionMetric, number[]>;
};

export async function getPrediction(branch_id: string): Promise<{
    prediction: BranchPrediction;
}> {
    return fetch(`/api/branches/${encodeURIComponent(branch_id)}/predict`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch prediction: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data;
        });
    });
}

export type Group = {
    group_id: string;
    name: string;
    created_at: string;
};

export async function getGroups(): Promise<Group[]> {
    return fetch(`/api/groups`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch groups: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data as Group[];
        });
    });
}

export async function getGroup(id: string): Promise<Group> {
    return fetch(`/api/groups/${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to fetch group: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data as Group;
        });
    });
}

export type CreateGroupInput = {
    name: string;
};

export async function createGroup(input: CreateGroupInput): Promise<Group> {
    return fetch(`/api/groups`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to create group: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data as Group;
        });
    });
}

export async function deleteGroup(id: string) {
    return fetch(`/api/groups/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to delete group: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
    });
}

export async function updateGroup(id: string, input: CreateGroupInput): Promise<Group> {
    return fetch(`/api/groups/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                `Failed to update group: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().then((data) => {
            return data.data as Group;
        });
    });
}

export async function changePassword(input: { old_password: string; new_password: string }) {
    return fetch(`/api/auth/change-password`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
    }).then(async (res) => {
        if (!res.ok) {
            // Prefer JSON error if provided, fallback to text.
            const json = await res.json().catch(() => null);
            const text = json?.error ?? (await res.text().catch(() => ""));
            throw new Error(
                `Failed to change password: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
            );
        }
        return res.json().catch(() => ({ ok: true }));
    });
}
