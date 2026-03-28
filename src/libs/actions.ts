"use client";

import { emitBranchesChanged } from "@/libs/branchEvents";

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

export async function getBranch(id: string) {
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
    status: string;
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
    items: {
        camera_id: string;
        branch_id: string;
        name: string;
        secret: string;
        updated_at: string;
    }[];
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

export async function getCamera(id: string): Promise<{
    camera_id: string;
    branch_id: string;
    name: string;
    secret: string;
    updated_at: string;
}> {
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

export async function getPrediction(branch_id: string): Promise<{
    prediction: {
        model_id: string;
        model_version: string;
        horizon: number;  // number of minutes the prediction covers into the future
        step_ahead: number;
        predictions: Record<"co2" | "temp" | "rh", number[]>;
    };
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