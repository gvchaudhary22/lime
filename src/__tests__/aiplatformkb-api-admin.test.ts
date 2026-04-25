// Phase 12 Wave 3-LIME-A — admin + tools client coverage.
// Mirrors the vi.fn() mock-fetch pattern in aiplatformkb-api.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AiplatformkbApiError,
  addApiToTool,
  archiveTool,
  createTool,
  getOperationCounts,
  getToolApis,
  listAdminModules,
  listAdminOperations,
  listTools,
  listToolsPublic,
  patchTool,
  removeApiFromTool,
  reorderModules,
  reorderOperations,
  reorderToolApis,
  setOperationEligibility,
} from "@/lib/aiplatformkb-api";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function errJson(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── never attaches Authorization header ──────────────────────────────────

describe("auth-less convention", () => {
  it("listAdminModules sends no Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listAdminModules();
    const [, init] = mockFetch.mock.calls[0];
    const h = ((init as RequestInit).headers || {}) as Record<string, string>;
    expect(h["Authorization"]).toBeUndefined();
    expect(h["authorization"]).toBeUndefined();
  });

  it("reorderModules POST sends no Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ updated: 2 }));
    await reorderModules({ ordered_modules: ["A", "B"] });
    const [, init] = mockFetch.mock.calls[0];
    const h = ((init as RequestInit).headers || {}) as Record<string, string>;
    expect(h["Authorization"]).toBeUndefined();
  });
});

// ── Modules ──────────────────────────────────────────────────────────────

describe("modules client", () => {
  it("listAdminModules hits /admin/modules", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson([{ module_name: "Auth", display_name: "Authentication", display_order: 10 }])
    );
    const result = await listAdminModules();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/modules$/);
    expect((init as RequestInit).method).toBe("GET");
    expect(result[0].module_name).toBe("Auth");
  });

  it("reorderModules POSTs JSON body", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ updated: 3 }));
    const result = await reorderModules({ ordered_modules: ["Auth", "Order", "Onboarding"] });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/modules\/reorder$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      ordered_modules: ["Auth", "Order", "Onboarding"],
    });
    expect(result.updated).toBe(3);
  });

  it("reorderModules throws on 404 unknown module", async () => {
    mockFetch.mockResolvedValueOnce(errJson(404, { detail: "unknown modules: ['Bogus']" }));
    await expect(reorderModules({ ordered_modules: ["Bogus"] })).rejects.toBeInstanceOf(
      AiplatformkbApiError
    );
  });
});

// ── Operations ───────────────────────────────────────────────────────────

describe("operations client", () => {
  it("listAdminOperations builds platform+module querystring", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listAdminOperations({ platform: "seller_panel", module: "Order" });
    const [url] = mockFetch.mock.calls[0];
    const u = String(url);
    expect(u).toMatch(/\/admin\/operations\?/);
    expect(u).toMatch(/platform=seller_panel/);
    expect(u).toMatch(/module=Order/);
  });

  it("reorderOperations POSTs the scope + ordered_ids", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ platform: "seller_panel", module: "Order", curated: 2 })
    );
    await reorderOperations({
      platform: "seller_panel",
      module: "Order",
      ordered_ids: [101, 102],
    });
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      platform: "seller_panel",
      module: "Order",
      ordered_ids: [101, 102],
    });
  });

  it("setOperationEligibility PATCHes /admin/operations/{id}/eligibility", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ id: 1744, ai_platform_eligible_api: true })
    );
    const r = await setOperationEligibility(1744, { eligible: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/operations\/1744\/eligibility$/);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ eligible: true });
    expect(r.ai_platform_eligible_api).toBe(true);
  });

  it("getOperationCounts hits /admin/operations/counts with platform query", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        platform: "seller_panel",
        total: 357,
        active: 258,
        deprecated: 99,
        by_module: { Order: { total: 119, active: 98, deprecated: 21 } },
      })
    );
    const r = await getOperationCounts("seller_panel");
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/operations\/counts\?.*platform=seller_panel/);
    expect(r.total).toBe(357);
    expect(r.by_module.Order.active).toBe(98);
  });
});

// ── Tools CRUD ───────────────────────────────────────────────────────────

describe("tools CRUD client", () => {
  it("listTools hits /admin/tools", async () => {
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listTools();
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/admin\/tools$/);
  });

  it("createTool POSTs payload", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ id: 5, name: "MyTool", description: null, display_order: 50, status: "draft" })
    );
    const tool = await createTool({ name: "MyTool" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(tool.id).toBe(5);
  });

  it("patchTool sends PATCH with subset", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ updated: 1 }));
    await patchTool(7, { description: "x" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools\/7$/);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ description: "x" });
  });

  it("archiveTool sends DELETE", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ archived: 7 }));
    await archiveTool(7);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools\/7$/);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("getToolApis lists members", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson([
        { api_listing_id: 100, http_method: "GET", path: "/api/v1/x", tool_name: "tool_x", position: 10 },
      ])
    );
    const members = await getToolApis(7);
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/admin\/tools\/7\/apis$/);
    expect(members[0].position).toBe(10);
  });
});

// ── Tool↔API membership ──────────────────────────────────────────────────

describe("tool↔api membership client", () => {
  it("addApiToTool POSTs api_id", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ tool_id: 7, api_listing_id: 100, added: 1, position: 10 })
    );
    const r = await addApiToTool(7, { api_id: 100 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools\/7\/apis$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(r.added).toBe(1);
  });

  it("removeApiFromTool DELETEs", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ tool_id: 7, api_listing_id: 100, removed: 1 }));
    await removeApiFromTool(7, 100);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools\/7\/apis\/100$/);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("reorderToolApis POSTs ordered_api_ids", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ tool_id: 7, reordered: 2 }));
    await reorderToolApis(7, { ordered_api_ids: [200, 100] });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/tools\/7\/reorder$/);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      ordered_api_ids: [200, 100],
    });
  });
});

// ── Public tools.json ────────────────────────────────────────────────────

describe("public tools.json client", () => {
  it("listToolsPublic hits /api/v1/ai-platform/tools.json", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ version: "1", tools: [] }));
    const r = await listToolsPublic();
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/v1\/ai-platform\/tools\.json$/);
    expect(r.version).toBe("1");
    expect(r.tools).toEqual([]);
  });
});
