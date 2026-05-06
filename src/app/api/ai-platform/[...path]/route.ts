// Server-side ai-platform admin proxy.
//
// All Lime calls to ai-platform's versioned admin surface (/v1/admin/*) flow
// through this Next.js Route Handler. Mirrors the aiplatformkb proxy at
// src/app/api/aiplatformkb/admin/[...path]/route.ts with three differences:
//
//   1. Mounted at /api/ai-platform/[...path] (no /admin/ segment) so the
//      version-prefixed path passes through verbatim — see Phase 4 D14.
//      Callers pass `/v1/admin/knowledgebase/platforms`; the upstream URL is
//      `${AI_PLATFORM_URL}/v1/admin/knowledgebase/platforms`.
//   2. Upstream base from `AI_PLATFORM_URL` (defaults to http://localhost:8000).
//   3. Bearer token from `AI_PLATFORM_ADMIN_TOKEN` (server-only env var).
//
// Same security invariants as the aiplatformkb proxy:
//   • The Authorization header from the incoming browser request is
//     unconditionally discarded. We never honor a client-supplied token.
//   • The token (when configured) is never logged.
//   • Hop-by-hop headers stripped on both legs; content-length recomputed by
//     fetch from the body.

import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE = process.env.AI_PLATFORM_URL || "http://localhost:8000";

// Hop-by-hop and host-specific headers that must NOT be forwarded upstream.
// `host` would mismatch upstream; `content-length` is recomputed by fetch
// from the body; `connection` / `transfer-encoding` are per-hop.
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "authorization", // never honor a client-supplied token
  "cookie", // upstream is a different origin; cookies don't apply
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  "transfer-encoding",
  "connection",
  "content-encoding", // fetch already decoded; re-emitting would double-decode
]);

async function proxy(req: NextRequest, params: { path: string[] }): Promise<Response> {
  const token = process.env.AI_PLATFORM_ADMIN_TOKEN || "";

  const subpath = (params.path || []).join("/");
  const search = req.nextUrl.search; // includes leading "?" or ""
  // No `/admin/` prefix here — the caller already supplies the version-
  // prefixed path (e.g. `/v1/admin/knowledgebase/platforms`), and the
  // upstream FastAPI mounts the admin router under `/v1/admin`.
  const upstreamUrl = `${UPSTREAM_BASE}/${subpath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // arrayBuffer() works for any content-type and preserves bytes exactly.
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch {
    // Generic message — do NOT include upstreamUrl (could leak env config).
    return NextResponse.json(
      { detail: "upstream unreachable" },
      { status: 502 },
    );
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    respHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

type RouteContext = { params: { path: string[] } };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params);
}
