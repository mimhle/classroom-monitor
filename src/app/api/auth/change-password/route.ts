import { NextResponse } from "next/server";

function getBackendBaseUrl() {
    const baseUrl = process.env.AUTH_API_BASE_URL || process.env.API_BASE_URL;
    if (!baseUrl) {
        throw new Error("Missing API_BASE_URL");
    }
    return baseUrl.replace(/\/$/, "");
}

export async function POST(req: Request) {
    try {
        const cookieHeader = req.headers.get("cookie") ?? "";
        const body = (await req.json()) as { old_password?: string; new_password?: string };

        const old_password = body?.old_password ?? "";
        const new_password = body?.new_password ?? "";

        if (!old_password || !new_password) {
            return NextResponse.json(
                { ok: false, error: "old_password and new_password are required" },
                { status: 400 },
            );
        }

        const upstream = await fetch(`${getBackendBaseUrl()}/api/auth/change-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                cookie: cookieHeader,
            },
            body: JSON.stringify({ old_password, new_password }),
            cache: "no-store",
        });

        const setCookie = upstream.headers.get("set-cookie");

        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => "");
            return NextResponse.json(
                { ok: false, error: errText || "Failed to change password" },
                { status: upstream.status },
            );
        }

        const res = NextResponse.json({ ok: true });
        if (setCookie) res.headers.set("set-cookie", setCookie);
        return res;
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Change password failed" },
            { status: 500 },
        );
    }
}
