// Phase 13 Wave 1C — server-side admin proxy.
//
// All Lime calls to aiplatformkb's /admin/* surface flow through this Next.js
// Route Handler. The handler reads the bearer token from server env
// (AIPLATFORMKB_ADMIN_TOKEN — NOT a NEXT_PUBLIC_* var) and injects it into
// the upstream request as `Authorization: Bearer <token>`. The token never
// reaches the browser, so a stolen Lime cookie cannot be used to call
// aiplatformkb directly.
//
// Security invariants:
//   • The Authorization header from the incoming browser request is
//     unconditionally discarded. We never honor a client-supplied token.
//   • The token is never logged.
//   • If AIPLATFORMKB_ADMIN_TOKEN is empty, every request gets 503 with a
//     generic message — no path information leaked, no upstream call made.
//
// Mirrors the OWASP recipe in BFRS-2/aiplatformkb:PHASE-12-PLAN.md §9.

import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_BASE =
  process.env.AIPLATFORMKB_URL ||
  process.env.NEXT_PUBLIC_AIPLATFORMKB_URL ||
  "http://localhost:8000";

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
  const token = process.env.AIPLATFORMKB_ADMIN_TOKEN || "";
  const isDev = process.env.NODE_ENV !== "production";

  if (!token && !isDev) {
    // Prod fail-closed. Generic message — never echo path or env-var name.
    return NextResponse.json(
      { detail: "admin proxy not configured" },
      { status: 503 },
    );
  }
  // Dev with no token: forward without Authorization header. aiplatformkb's
  // app/auth/admin_token.py grants a loopback dev-unblock when its own env
  // var is also empty, so the upstream call succeeds locally without any
  // shared secret. Prod always requires the token (gated above).

  const subpath = (params.path || []).join("/");
  const search = req.nextUrl.search; // includes leading "?" or ""
  const upstreamUrl = `${UPSTREAM_BASE}/admin/${subpath}${search}`;

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
