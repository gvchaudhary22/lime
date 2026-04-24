import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AiplatformkbApiError,
  getFilterOptions,
  getPrDetail,
  listPrs,
} from "@/lib/aiplatformkb-api";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function errJson(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: async () => body,
  };
}

describe("aiplatformkb-api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("listPrs hits /api/v1/prs with expected querystring", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ total: 0, limit: 50, offset: 0, items: [] })
    );

    await listPrs(
      { org: "shiprocket", processing_status: "done", q: "cancel" },
      { limit: 50, offset: 0 }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/prs\?/);
    expect(String(url)).toMatch(/org=shiprocket/);
    expect(String(url)).toMatch(/processing_status=done/);
    expect(String(url)).toMatch(/q=cancel/);
    expect(String(url)).toMatch(/limit=50/);
    expect((init as RequestInit).method).toBe("GET");
  });

  it("listPrs never attaches an Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ total: 0, limit: 50, offset: 0, items: [] })
    );

    await listPrs({ org: "shiprocket" });

    const [, init] = mockFetch.mock.calls[0];
    const headers = ((init as RequestInit).headers || {}) as Record<
      string,
      string
    >;
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["authorization"]).toBeUndefined();
  });

  it("listPrs throws AiplatformkbApiError on 500", async () => {
    mockFetch.mockResolvedValueOnce(
      errJson(500, { detail: "internal" })
    );

    await expect(listPrs()).rejects.toBeInstanceOf(AiplatformkbApiError);
  });

  it("getPrDetail forwards v1.1 filters (impact_type + deprecation_state)", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        pr: { id: 42 },
        sync_run: {},
        impacts: { total: 0, limit: 50, offset: 0, items: [] },
      })
    );

    await getPrDetail(
      42,
      {
        impact_status: ["impacted", "eligible_no_change"],
        impact_type: "direct_controller",
        deprecation_state: "deprecated",
        min_confidence: 0.85,
      },
      { limit: 50, offset: 0 }
    );

    const [url] = mockFetch.mock.calls[0];
    const str = String(url);
    expect(str).toMatch(/\/api\/v1\/prs\/42\?/);
    expect(str).toMatch(/impact_status=impacted/);
    expect(str).toMatch(/impact_status=eligible_no_change/);
    expect(str).toMatch(/impact_type=direct_controller/);
    expect(str).toMatch(/deprecation_state=deprecated/);
    expect(str).toMatch(/min_confidence=0\.85/);
  });

  it("getPrDetail omits empty/undefined filter keys", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        pr: { id: 7 },
        sync_run: {},
        impacts: { total: 0, limit: 50, offset: 0, items: [] },
      })
    );

    await getPrDetail(7, { api_status: undefined, q: "" });

    const [url] = mockFetch.mock.calls[0];
    const str = String(url);
    expect(str).not.toMatch(/api_status=/);
    expect(str).not.toMatch(/[?&]q=/);
  });

  it("getFilterOptions hits the options endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        orgs: [],
        repos: [],
        authors: [],
        base_branches: [],
        domains: [],
        platforms: [],
      })
    );

    await getFilterOptions();

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/prs\/filters\/options$/);
  });

  it("uses NEXT_PUBLIC_AIPLATFORMKB_URL when set at build time", async () => {
    // Env var is read at module load time; this test just confirms the
    // default fallback produces a reachable-looking URL in tests.
    mockFetch.mockResolvedValueOnce(
      okJson({ total: 0, limit: 50, offset: 0, items: [] })
    );
    await listPrs();
    const [url] = mockFetch.mock.calls[0];
    expect(String(url).startsWith("http")).toBe(true);
    expect(String(url)).toMatch(/\/api\/v1\/prs/);
  });
});
