// Phase 13 Wave 3A — pr-sync client + useSyncRowStatus hook tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import {
  cancelPrSync,
  discoverPrs,
  getPrSyncStatus,
  previewClassify,
  previewPopulate,
  triggerClassify,
  triggerPopulate,
} from "@/lib/aiplatformkb-api";
import { useSyncRowStatus } from "@/hooks/useSyncRowStatus";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── client ──────────────────────────────────────────────────────────────

describe("pr-sync client", () => {
  it("discoverPrs POSTs through admin proxy with body", async () => {
    // Phase-23 — discover is async. POST returns 202 with
    // {sync_run_id, status:"running", scope}.
    mockFetch.mockResolvedValueOnce(
      okJson({
        sync_run_id: 42,
        status: "running",
        scope: "shiprocket/MultiChannel_API",
      })
    );
    const r = await discoverPrs({ org: "shiprocket", repo: "MultiChannel_API" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/aiplatformkb\/admin\/pr-sync\/discover$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      org: "shiprocket",
      repo: "MultiChannel_API",
    });
    expect(r.sync_run_id).toBe(42);
    expect(r.status).toBe("running");
  });

  it("previewClassify uses GET", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ pr_id: 99, file_count: 50, est_cost_usd: 0.6, cached_hit: false })
    );
    await previewClassify(99);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/prs\/99\/classify\/preview$/);
    expect((init as RequestInit).method).toBe("GET");
  });

  it("triggerClassify uses POST without body", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        pr_id: 99,
        classify_status: "running",
        cached_hit: false,
        impact_count: 0,
        classify_cost_usd: 0.6,
      })
    );
    await triggerClassify(99);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/prs\/99\/classify$/);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("previewPopulate hits the right path", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ pr_id: 99, path_count: 12, est_cost_usd: 3.6 })
    );
    await previewPopulate(99);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/prs\/99\/populate\/preview$/);
  });

  it("triggerPopulate is POST", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        pr_id: 99,
        populate_status: "running",
        paths_populated: 0,
        populate_cost_usd: 3.6,
      })
    );
    await triggerPopulate(99);
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
  });

  it("cancelPrSync POSTs", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ pr_id: 99, cancelled: ["classify"], was_already_terminated: false })
    );
    const r = await cancelPrSync(99);
    expect(r.cancelled).toEqual(["classify"]);
  });
});

// ── hook ────────────────────────────────────────────────────────────────

describe("useSyncRowStatus", () => {
  it("polls until both lifecycle states are terminal then stops", async () => {
    // 3 polls: running/running → done/running → done/done
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          pr_number: 4242,
          classify_status: "running",
          classified_at: null,
          classify_cost_usd: 0,
          populate_status: "pending",
          populate_at: null,
          populate_cost_usd: 0,
        })
      )
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          pr_number: 4242,
          classify_status: "done",
          classified_at: "2026-04-26T10:00:00Z",
          classify_cost_usd: 0.6,
          populate_status: "running",
          populate_at: null,
          populate_cost_usd: 0,
        })
      )
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          pr_number: 4242,
          classify_status: "done",
          classified_at: "2026-04-26T10:00:00Z",
          classify_cost_usd: 0.6,
          populate_status: "done",
          populate_at: "2026-04-26T10:05:00Z",
          populate_cost_usd: 3.6,
        })
      );

    // 200ms beats 50ms when vitest's parallel runner is loaded — keeps
    // the test stable in the combined suite without losing meaning.
    const { result } = renderHook(() => useSyncRowStatus(99, 200));

    await waitFor(
      () => expect(result.current.status?.classify_status).toBe("running"),
      { timeout: 4000 }
    );
    await waitFor(
      () => expect(result.current.status?.populate_status).toBe("done"),
      { timeout: 4000 }
    );
    await waitFor(() => expect(result.current.isPolling).toBe(false), {
      timeout: 4000,
    });
    expect(result.current.error).toBeNull();
  });
});
