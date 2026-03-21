import { NextResponse } from "next/server";

function getBackendBaseUrl() {
    const baseUrl = process.env.AUTH_API_BASE_URL;
    if (!baseUrl) {
        throw new Error("Missing AUTH_API_BASE_URL");
    }
    return baseUrl.replace(/\/$/, "");
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as { username?: string; password?: string };
        const username = body?.username?.trim();
        const password = body?.password ?? "";

        if (!username || !password) {
            return NextResponse.json(
                { ok: false, error: "username and password are required" },
                { status: 400 },
            );
        }

        const upstream = await fetch(`${getBackendBaseUrl()}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({ username, password }),
            cache: "no-store",
        });

        const setCookie = upstream.headers.get("set-cookie");

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => "");
            return NextResponse.json(
                { ok: false, error: errText || "Invalid username or password" },
                { status: upstream.status },
            );
        }

        const res = NextResponse.json({ ok: true });
        if (setCookie) res.headers.set("set-cookie", setCookie);
        return res;
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Login failed" },
            { status: 500 },
        );
    }
}
