import { NextResponse } from "next/server";

function getBackendBaseUrl() {
    const baseUrl = process.env.AUTH_API_BASE_URL;
    if (!baseUrl) {
        throw new Error("Missing AUTH_API_BASE_URL");
    }
    return baseUrl.replace(/\/$/, "");
}

export async function GET(req: Request) {
    try {
        // Forward browser cookies to backend to validate the session.
        const cookieHeader = req.headers.get("cookie") ?? "";

        const upstream = await fetch(`${getBackendBaseUrl()}/api/auth/validate`, {
            method: "GET",
            headers: {
                cookie: cookieHeader,
            },
            cache: "no-store",
        });

        console.debug("Auth validation request sent to backend with cookies:", cookieHeader);
        console.log("Auth validation upstream response:", upstream.status, upstream.statusText);

        if (!upstream.ok) {
            return NextResponse.json({ ok: false }, { status: 401 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Validation failed" },
            { status: 500 },
        );
    }
}
