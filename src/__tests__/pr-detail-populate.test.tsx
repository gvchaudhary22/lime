// Phase 13 Wave 3C — RunPopulateButton + PopulateProgressBanner tests.
// Phase-25 Wave-3E — RunPopulateButton refactored as the async-job
// state machine (no more preview→confirm). V5 locks the new contract:
// disabled until classifyStatus="done", click → triggerPopulate fires
// directly, polling drives terminal state.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import RunPopulateButton from "@/components/pr-sync/RunPopulateButton";
import PopulateProgressBanner from "@/components/pr-sync/PopulateProgressBanner";
import type { PrSyncStatus } from "@/types/pr-sync";

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

describe("RunPopulateButton — Phase 25 async populate", () => {
  it("V5 disabled until classifyStatus='done'; click fires triggerPopulate", async () => {
    // Render with classify pending — button must be disabled with the
    // "Classify impacts first" tooltip.
    const { rerender } = render(
      <RunPopulateButton
        prId={99}
        classifyStatus="pending"
        populateStatus="pending"
      />
    );
    let btn = screen.getByRole("button", { name: /run kb_populate/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/classify/i));

    // Re-render with classify done — button now enabled.
    rerender(
      <RunPopulateButton
        prId={99}
        classifyStatus="done"
        populateStatus="pending"
      />
    );
    btn = screen.getByRole("button", { name: /run kb_populate/i });
    expect(btn).not.toBeDisabled();

    // Click → POST returns 202 with the accepted handle. The polling
    // hook then takes over (we resolve subsequent calls to running so
    // the test focuses on the trigger contract).
    mockFetch
      .mockResolvedValueOnce(
        okJson({ sync_run_pr_id: 99, status: "running" })
      )
      .mockResolvedValue(
        okJson({
          sync_run_pr_id: 99,
          status: "running",
          populate_at: null,
          populate_cost_usd: 0,
          error_detail: null,
        })
      );
    const onTriggered = vi.fn();
    rerender(
      <RunPopulateButton
        prId={99}
        classifyStatus="done"
        populateStatus="pending"
        onTriggered={onTriggered}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /run kb_populate/i }));
    await waitFor(() => expect(onTriggered).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/prs\/99\/populate$/);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("populateStatus='done' hides the button (pipeline complete)", () => {
    const { container } = render(
      <RunPopulateButton
        prId={99}
        classifyStatus="done"
        populateStatus="done"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("PopulateProgressBanner", () => {
  function makeStatus(over: Partial<PrSyncStatus>): PrSyncStatus {
    return {
      pr_id: 99,
      pr_number: 1,
      classify_status: "done",
      classified_at: "2026-04-26",
      classify_cost_usd: 0.6,
      populate_status: "pending",
      populate_at: null,
      populate_cost_usd: 0,
      ...over,
    };
  }

  it("hidden when populate not running", () => {
    const { container } = render(
      <PopulateProgressBanner status={makeStatus({ populate_status: "done" })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders running with cost; cancel triggers cancelPrSync", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ pr_id: 99, cancelled: ["populate"], was_already_terminated: false })
    );
    const onCancelled = vi.fn();
    render(
      <PopulateProgressBanner
        status={makeStatus({ populate_status: "running", populate_cost_usd: 1.08 })}
        onCancelled={onCancelled}
      />
    );
    expect(
      screen.getByText(/Populating · ~\$1\.08 spent/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(String(mockFetch.mock.calls[0][0])).toMatch(
      /\/admin\/pr-sync\/prs\/99\/cancel$/
    );
  });
});
