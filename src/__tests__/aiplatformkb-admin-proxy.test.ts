// Phase 13 Wave 1C — server-side admin proxy tests.
//
// Locks the security-critical contract of /api/aiplatformkb/admin/[...path]:
//   1. Forwards method + body + path-suffix + query-string to upstream.
//   2. Injects Authorization: Bearer <env> on every upstream call.
//   3. Strips a client-supplied Authorization header (must NOT honor it).
//   4. Returns 503 (no upstream call) when AIPLATFORMKB_ADMIN_TOKEN is empty.
//   5. Returns 502 (no token leak) when upstream is unreachable.
//
// Strategy: stub global.fetch to intercept the upstream call, build a real
// NextRequest, and call the route handler directly. This exercises the
// actual handler — no shimming — while keeping the test process synchronous.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Lazy import so each test loads the module under fresh env.
async function loadHandlers() {
  vi.resetModules();
  return await import(
    "@/app/api/aiplatformkb/admin/[...path]/route"
  );
}

const TOKEN = "test-token-abc-123";
const UPSTREAM = "http://upstream.test";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.AIPLATFORMKB_ADMIN_TOKEN = TOKEN;
  process.env.AIPLATFORMKB_URL = UPSTREAM;
  delete process.env.NEXT_PUBLIC_AIPLATFORMKB_URL;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makeRequest(
  method: string,
  url: string,
  init: { body?: BodyInit; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(url, {
    method,
    body: init.body ?? null,
    headers: init.headers,
  });
}

describe("admin proxy — happy path", () => {
  it("forwards GET with query string + injects bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await loadHandlers();
    const req = makeRequest(
      "GET",
      "http://lime.test/api/aiplatformkb/admin/operations?platform=seller_panel&module=Order",
    );
    const res = await GET(req, { params: { path: ["operations"] } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(upstreamUrl).toBe(
      `${UPSTREAM}/admin/operations?platform=seller_panel&module=Order`,
    );
    expect(upstreamInit.method).toBe("GET");
    const headers = upstreamInit.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("forwards POST with JSON body + content-type header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ updated: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { POST } = await loadHandlers();
    const body = JSON.stringify({ ordered_modules: ["Auth", "Order"] });
    const req = makeRequest(
      "POST",
      "http://lime.test/api/aiplatformkb/admin/modules/reorder",
      {
        body,
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req, {
      params: { path: ["modules", "reorder"] },
    });
    expect(res.status).toBe(200);

    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(upstreamUrl).toBe(`${UPSTREAM}/admin/modules/reorder`);
    expect(upstreamInit.method).toBe("POST");
    const headers = upstreamInit.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("Content-Type")).toBe("application/json");
    // arrayBuffer body roundtrips identical bytes
    const sent = new TextDecoder().decode(
      upstreamInit.body as ArrayBuffer,
    );
    expect(sent).toBe(body);
  });
});

describe("admin proxy — security", () => {
  it("strips client-supplied Authorization header (never honored)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await loadHandlers();
    const req = makeRequest(
      "GET",
      "http://lime.test/api/aiplatformkb/admin/modules",
      {
        headers: {
          authorization: "Bearer attacker-supplied-token",
          cookie: "session=should-not-forward",
        },
      },
    );
    await GET(req, { params: { path: ["modules"] } });

    const [, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = upstreamInit.headers as Headers;
    // Authorization replaced, NOT preserved
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("Authorization")).not.toContain("attacker-supplied-token");
    // Cookie also stripped — different origin
    expect(headers.get("Cookie")).toBeNull();
  });

  it("returns 503 + makes NO upstream call when token env unset", async () => {
    delete process.env.AIPLATFORMKB_ADMIN_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await loadHandlers();
    const req = makeRequest(
      "GET",
      "http://lime.test/api/aiplatformkb/admin/modules",
    );
    const res = await GET(req, { params: { path: ["modules"] } });

    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body).toEqual({ detail: "admin proxy not configured" });
    // Generic message — must not echo env-var name or path.
    expect(JSON.stringify(body)).not.toContain("AIPLATFORMKB_ADMIN_TOKEN");
    expect(JSON.stringify(body)).not.toContain("modules");
  });
});

describe("admin proxy — upstream errors", () => {
  it("returns 502 with generic message when upstream fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED upstream.test:80"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { GET } = await loadHandlers();
    const req = makeRequest(
      "GET",
      "http://lime.test/api/aiplatformkb/admin/modules",
    );
    const res = await GET(req, { params: { path: ["modules"] } });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ detail: "upstream unreachable" });
    // Must not leak the upstream URL or env config in the error body.
    expect(JSON.stringify(body)).not.toContain(UPSTREAM);
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});
