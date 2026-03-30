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

        const upstream = await fetch(`${getBackendBaseUrl()}/api/auth/logout`, {
            method: "POST",
            headers: {
                cookie: cookieHeader,
            },
            cache: "no-store",
        });

        const res = NextResponse.json({ ok: true });

        const setCookie = upstream.headers.get("set-cookie");
        if (setCookie) {
            res.headers.set("set-cookie", setCookie);
        }

        return res;
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Logout failed" },
            { status: 500 },
        );
    }
}
