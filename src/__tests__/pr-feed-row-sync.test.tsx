// Phase 13 Wave 3B — RepoSyncButton + PerRowSyncImpactsButton + inline summary tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import RepoSyncButton from "@/components/pr-sync/RepoSyncButton";
import PerRowSyncImpactsButton from "@/components/pr-sync/PerRowSyncImpactsButton";
import SyncProgressInlineSummary from "@/components/pr-sync/SyncProgressInlineSummary";
import type { PrSyncStatus } from "@/types/pr-sync";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Phase-22 (Wave-3C) — !ok response with a parseable JSON body. Used to
// drive the structured-detail / generic-fallback branches in jsonRequest.
function errJson(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

// Phase-22 (Wave-3C) — !ok response whose body isn't JSON (legacy 500
// "Internal Server Error"). The api-client's res.json() rejects → the
// parser falls back to "discover failed (<status>)".
function errNonJson(status: number) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error("invalid json");
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── RepoSyncButton ──────────────────────────────────────────────────────

describe("RepoSyncButton", () => {
  it("disabled when org/repo unset", () => {
    render(<RepoSyncButton org={null} repo={null} />);
    const btn = screen.getByRole("button", { name: /sync new prs/i });
    expect(btn).toBeDisabled();
  });

  it("calls discoverPrs and onDiscovered on click", async () => {
    // Phase-23 — discover is async. POST returns 202 with
    // {sync_run_id, status:"running", scope}; polling status flips to
    // "done" with the discovered counts, which fires onDiscovered.
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          sync_run_id: 1,
          status: "running",
          scope: "shiprocket/MultiChannel_API",
        })
      )
      .mockResolvedValue(
        okJson({
          sync_run_id: 1,
          org: "shiprocket",
          repo: "MultiChannel_API",
          status: "done",
          started_at: "2026-04-28T10:00:00Z",
          finished_at: "2026-04-28T10:00:01Z",
          error_message: null,
          error_detail: null,
          discovered_count: 3,
          discovered_pr_ids: [10, 11, 12],
        })
      );
    const onDiscovered = vi.fn();
    render(
      <RepoSyncButton
        org="shiprocket"
        repo="MultiChannel_API"
        onDiscovered={onDiscovered}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    await waitFor(() =>
      expect(onDiscovered).toHaveBeenCalledWith(3, [10, 11, 12])
    );
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/discover$/);
  });
});

// Phase-22 Wave-3C — RepoSyncButton renders the new structured GitHub
// error detail (kind/github_status/github_message/hint) emitted by the
// backend when GitHub itself rejects the discover call. The button's
// catch path stringifies err.message; the api-client's jsonRequest
// formats `GitHub <status>: <msg> — <hint>` from the structured detail.
describe("RepoSyncButton — Phase 22 GitHub errors", () => {
  it("renders structured GitHub error with hint in 2-row layout", async () => {
    mockFetch.mockResolvedValueOnce(
      errJson(422, {
        detail: {
          kind: "http",
          github_status: 422,
          github_message: "Validation Failed",
          github_errors: [
            { resource: "Search", field: "q", code: "invalid", message: "..." },
          ],
          url: "https://api.github.com/search/issues?q=repo:acme/widgets+is:pr+is:merged",
          hint: "Repo cannot be searched. Either it doesn't exist OR the configured GITHUB_TOKEN can't see it...",
        },
      })
    );
    render(<RepoSyncButton org="acme" repo="widgets" />);
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    // Row 1: GitHub status + message (rose-400).
    await waitFor(() =>
      expect(
        screen.getByText(/GitHub 422: Validation Failed/i)
      ).toBeInTheDocument()
    );
    // Row 2: hint (slate-400). Two distinct text nodes confirm the
    // 2-row layout from Wave-3B is wired up.
    expect(screen.getByText(/can't see it/i)).toBeInTheDocument();
  });

  it("renders generic 'discover failed' for non-structured errors", async () => {
    // Legacy 500 with a non-JSON body — jsonRequest's res.json() rejects,
    // parser falls back to the op-specific "discover failed (500)" label
    // emitted by _runWithOpLabel.
    mockFetch.mockResolvedValueOnce(errNonJson(500));
    const { container } = render(
      <RepoSyncButton org="acme" repo="widgets" />
    );
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    await waitFor(() =>
      expect(screen.getByText(/discover failed \(500\)/)).toBeInTheDocument()
    );
    // No 2-row block: the hint row (slate-400) must NOT be in the DOM
    // for non-structured fallbacks.
    expect(container.querySelector(".text-slate-400")).toBeNull();
  });
});

// Phase-23 (Wave-3D) — RepoSyncButton drives an async-job state machine.
// Click → POST 202 ({sync_run_id, status:"running", scope}) → poll
// /discover/{id}/status → terminal flips to "done" or "failed". The
// 2-row error block JSX (Phase-22) is reused — the only change is the
// error source (jobStatus.error_detail instead of a thrown Error).
describe("RepoSyncButton — Phase 23 async job", () => {
  it("V1 click → 202 → polls → done with count fires onDiscovered", async () => {
    // 1st fetch: POST /admin/pr-sync/discover → 202 with sync_run_id=42.
    // 2nd fetch: GET /discover/42/status → still running.
    // 3rd+ fetches: GET /discover/42/status → done with count.
    mockFetch
      .mockResolvedValueOnce(
        okJson({ sync_run_id: 42, status: "running", scope: "acme/widgets" })
      )
      .mockResolvedValueOnce(
        okJson({
          sync_run_id: 42,
          org: "acme",
          repo: "widgets",
          status: "running",
          started_at: "2026-04-28T10:00:00Z",
          finished_at: null,
          error_message: null,
          error_detail: null,
          discovered_count: null,
          discovered_pr_ids: null,
        })
      )
      .mockResolvedValue(
        okJson({
          sync_run_id: 42,
          org: "acme",
          repo: "widgets",
          status: "done",
          started_at: "2026-04-28T10:00:00Z",
          finished_at: "2026-04-28T10:00:03Z",
          error_message: null,
          error_detail: null,
          discovered_count: 5,
          discovered_pr_ids: [101, 102, 103, 104, 105],
        })
      );
    const onDiscovered = vi.fn();
    render(
      <RepoSyncButton
        org="acme"
        repo="widgets"
        onDiscovered={onDiscovered}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    // The hook polls every 2000ms; waitFor() default 1000ms isn't enough.
    // Use a generous timeout that lets at least one polling tick land.
    await waitFor(
      () =>
        expect(onDiscovered).toHaveBeenCalledWith(
          5,
          [101, 102, 103, 104, 105]
        ),
      { timeout: 5000 }
    );
    // Button returns to enabled (activeJobId cleared after terminal "done").
    expect(
      screen.getByRole("button", { name: /sync new prs/i })
    ).not.toBeDisabled();
  }, 10000);

  it("V2 click → 202 → polls → failed renders structured GitHub error in 2-row block", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({
          sync_run_id: 99,
          status: "running",
          scope: "shiprocket/MultiChannel_API",
        })
      )
      .mockResolvedValueOnce(
        okJson({
          sync_run_id: 99,
          org: "shiprocket",
          repo: "MultiChannel_API",
          status: "running",
          started_at: "2026-04-28T10:00:00Z",
          finished_at: null,
          error_message: null,
          error_detail: null,
          discovered_count: null,
          discovered_pr_ids: null,
        })
      )
      .mockResolvedValue(
        okJson({
          sync_run_id: 99,
          org: "shiprocket",
          repo: "MultiChannel_API",
          status: "failed",
          started_at: "2026-04-28T10:00:00Z",
          finished_at: "2026-04-28T10:00:02Z",
          error_message: "GitHub http error 422: Validation Failed",
          error_detail: {
            kind: "http",
            github_status: 422,
            github_message: "Validation Failed",
            github_errors: [
              { message: "cannot be searched", code: "invalid" },
            ],
            url: "https://api.github.com/search/issues?q=...",
            hint:
              "Repo cannot be searched. Either it doesn't exist OR the configured GITHUB_TOKEN can't see it (e.g., private repo + non-member token).",
          },
          discovered_count: null,
          discovered_pr_ids: null,
        })
      );
    render(<RepoSyncButton org="shiprocket" repo="MultiChannel_API" />);
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    // Row 1: GitHub status + message (rose-400).
    await waitFor(
      () =>
        expect(
          screen.getByText(/GitHub 422: Validation Failed/i)
        ).toBeInTheDocument(),
      { timeout: 5000 }
    );
    // Row 2: hint (slate-400). Two distinct text nodes confirm the
    // existing Phase-22 2-row layout still fires for the new error
    // source (jobStatus.error_detail).
    expect(screen.getByText(/can't see it/i)).toBeInTheDocument();
  }, 10000);

  it("V3 unmount mid-poll triggers no setState-after-unmount warnings", async () => {
    // POST 202 resolves immediately; status fetch hangs forever
    // (resolves AFTER unmount via a delayed promise). The hook's
    // alive-guard ref MUST suppress the late setState.
    let resolveStatus: (v: unknown) => void = () => {};
    const hangingStatus = new Promise<unknown>((resolve) => {
      resolveStatus = resolve;
    });
    mockFetch
      .mockResolvedValueOnce(
        okJson({ sync_run_id: 1, status: "running", scope: "x/y" })
      )
      .mockReturnValueOnce(hangingStatus);

    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { unmount } = render(<RepoSyncButton org="x" repo="y" />);
    fireEvent.click(screen.getByRole("button", { name: /sync new prs/i }));
    // Wait for the POST to resolve and the polling to start.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1), {
      timeout: 5000,
    });
    // Unmount BEFORE the status fetch resolves.
    unmount();
    // Now release the hanging status fetch.
    resolveStatus(
      okJson({
        sync_run_id: 1,
        org: "x",
        repo: "y",
        status: "running",
        started_at: "2026-04-28T10:00:00Z",
        finished_at: null,
        error_message: null,
        error_detail: null,
        discovered_count: null,
        discovered_pr_ids: null,
      })
    );
    // Give microtasks a turn to run the (cancelled) tick body.
    await new Promise((r) => setTimeout(r, 50));
    // No setState-after-unmount warnings — alive-guard contract holds.
    const offendingCalls = errSpy.mock.calls.filter((args) =>
      args.some(
        (a) =>
          typeof a === "string" &&
          (/setState.*unmounted/i.test(a) ||
            /Can't perform.*unmounted/i.test(a))
      )
    );
    expect(offendingCalls).toHaveLength(0);
    errSpy.mockRestore();
  }, 10000);
});

// ── PerRowSyncImpactsButton ─────────────────────────────────────────────

describe("PerRowSyncImpactsButton", () => {
  it("preview surfaces file_count + est cost; confirm fires trigger", async () => {
    // 1: preview (not cached); 2: trigger
    mockFetch
      .mockResolvedValueOnce(
        okJson({ pr_id: 99, file_count: 50, est_cost_usd: 0.6, cached_hit: false })
      )
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          classify_status: "running",
          cached_hit: false,
          impact_count: 0,
          classify_cost_usd: 0.6,
        })
      )
      // First polling fetch from useSyncRowStatus (status endpoint)
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          pr_number: 1,
          classify_status: "running",
          classified_at: null,
          classify_cost_usd: 0,
          populate_status: "pending",
          populate_at: null,
          populate_cost_usd: 0,
        })
      );
    render(<PerRowSyncImpactsButton prId={99} />);
    fireEvent.click(screen.getByRole("button", { name: /sync impacts/i }));
    await waitFor(() =>
      expect(screen.getByText(/50 files · ~\$0\.60/)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // After confirm, hook starts polling — UI shows "Classifying…"
    await waitFor(() =>
      expect(screen.getByText(/classifying/i)).toBeInTheDocument()
    );
  });

  it("cached_hit short-circuits preview straight into polling", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({ pr_id: 99, file_count: 12, est_cost_usd: 0.144, cached_hit: true })
      )
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          pr_number: 1,
          classify_status: "done",
          classified_at: "2026-04-26",
          classify_cost_usd: 0.144,
          populate_status: "pending",
          populate_at: null,
          populate_cost_usd: 0,
        })
      );
    render(<PerRowSyncImpactsButton prId={99} />);
    fireEvent.click(screen.getByRole("button", { name: /sync impacts/i }));
    await waitFor(() =>
      expect(screen.getByText(/Classified · 0\.14\$/)).toBeInTheDocument()
    );
    // Confirm button never appears.
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
  });
});

// ── SyncProgressInlineSummary ───────────────────────────────────────────

describe("SyncProgressInlineSummary", () => {
  function makeStatus(over: Partial<PrSyncStatus>): PrSyncStatus {
    return {
      pr_id: 99,
      pr_number: 1,
      classify_status: "pending",
      classified_at: null,
      classify_cost_usd: 0,
      populate_status: "pending",
      populate_at: null,
      populate_cost_usd: 0,
      ...over,
    };
  }

  it("shows Done with total cost when both terminal", () => {
    render(
      <SyncProgressInlineSummary
        status={makeStatus({
          classify_status: "done",
          classify_cost_usd: 0.6,
          populate_status: "done",
          populate_cost_usd: 3.6,
        })}
      />
    );
    expect(screen.getByText(/Done · \$4\.20/)).toBeInTheDocument();
  });

  it("shows Failed when any axis failed", () => {
    render(
      <SyncProgressInlineSummary
        status={makeStatus({ populate_status: "failed" })}
      />
    );
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});
