export type LoginResponse = {
    sessionId: string;
    /** Optional seconds until expiry, if the auth service returns it */
    expiresIn?: number;
};

export type ExternalUser = {
    username?: string;
    [k: string]: unknown;
};

function getBaseUrl() {
    const baseUrl = process.env.AUTH_API_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            "Missing AUTH_API_BASE_URL. Configure it in your environment (.env.local).",
        );
    }
    return baseUrl.replace(/\/$/, "");
}

function getAuthHeaders() {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    const apiKey = process.env.AUTH_API_KEY;
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return headers;
}

async function safeJson(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * iots-backend: POST /api/auth/login
 * - Sets a server-side session cookie (Starlette SessionMiddleware).
 * - JSON body is ResponseMessage with data.user.
 */
export async function externalLogin(username: string, password: string) {
    const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username, password }),
        cache: "no-store",
        // important: allow receiving session cookie
        credentials: "include",
    });

    if (!res.ok) {
        const body = await safeJson(res);
        const msg =
            typeof body === "string"
                ? body
                : (body as any)?.detail || (body as any)?.message || res.statusText;
        const err = new Error(`External login failed (${res.status}): ${msg}`);
        (err as any).status = res.status;
        throw err;
    }

    return safeJson(res);
}

/** iots-backend: POST /api/auth/logout (clears session cookie) */
export async function externalLogout() {
    await fetch(`${getBaseUrl()}/api/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
        cache: "no-store",
        credentials: "include",
    }).catch(() => {
        // ignore
    });
}

/**
 * There is no /me endpoint in iots-backend.
 * Validate session by calling any protected endpoint (e.g. GET /api/groups).
 */
export async function externalValidateSession() {
    const res = await fetch(`${getBaseUrl()}/api/groups`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
        credentials: "include",
    });

    return res.ok;

}
