import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HOP_BY_HOP_HEADERS = new Set([]);

const LOCAL_PREFIXES = [
    // Keep local auth routes handled by Next (src/app/api/auth/*)
    "auth",
];

function getBackendBaseUrl() {
    const baseUrl = process.env.AUTH_API_BASE_URL;
    if (!baseUrl) throw new Error("Missing AUTH_API_BASE_URL");
    return baseUrl.replace(/\/$/, "");
}

function buildUpstreamUrl(req: Request, rest: string[]) {
    const incoming = new URL(req.url);
    const path = rest.map(encodeURIComponent).join("/");

    // Map: /api/<rest> -> <AUTH_API_BASE_URL>/api/<rest>
    const upstream = new URL(`${getBackendBaseUrl()}/api/${path}`);
    upstream.search = incoming.search;
    return upstream;
}

function buildUpstreamHeaders(req: Request) {
    const headers = new Headers();

    req.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k === "content-length") return;
        if (k === "accept-encoding") return;

        headers.set(key, value);
    });

    if (!headers.has("accept")) headers.set("accept", "application/json");
    return headers;
}

async function proxy(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    const { rest } = await ctx.params;

    // Don’t proxy routes that we expect to be handled locally.
    const first = rest?.[0] ?? "";
    if (LOCAL_PREFIXES.includes(first)) {
        return NextResponse.json(
            { ok: false, error: `Local API route '/api/${first}/*' is not proxied.` },
            { status: 404 },
        );
    }

    const upstreamUrl = buildUpstreamUrl(req, rest);

    const method = req.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    const upstreamRes = await fetch(
        upstreamUrl,
        {
            method,
            headers: buildUpstreamHeaders(req),
            body: hasBody ? req.body : undefined,
            duplex: hasBody ? "half" : undefined,
            cache: "no-store",
            redirect: "manual",
        } as any,
    );

    const resHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
        resHeaders.set(key, value);
    });

    return new NextResponse(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: resHeaders,
    });
}

export async function GET(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function POST(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function PUT(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function OPTIONS(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}

export async function HEAD(req: Request, ctx: { params: Promise<{ rest: string[] }> }) {
    return proxy(req, ctx);
}
