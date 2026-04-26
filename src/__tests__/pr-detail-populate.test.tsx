// Phase 13 Wave 3C — RunPopulateButton + PopulateProgressBanner tests.

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

describe("RunPopulateButton", () => {
  it("disabled until classify_status='done'", () => {
    render(
      <RunPopulateButton
        prId={99}
        classifyStatus="pending"
        populateStatus="pending"
      />
    );
    const btn = screen.getByRole("button", { name: /run kb_populate/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/classify/i));
  });

  it("preview surfaces path_count + est cost", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ pr_id: 99, path_count: 12, est_cost_usd: 3.6 })
    );
    render(
      <RunPopulateButton
        prId={99}
        classifyStatus="done"
        populateStatus="pending"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /run kb_populate/i }));
    await waitFor(() =>
      expect(screen.getByText(/12 routes · ~\$3\.60/)).toBeInTheDocument()
    );
  });

  it("confirm fires triggerPopulate", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson({ pr_id: 99, path_count: 5, est_cost_usd: 1.5 })
      )
      .mockResolvedValueOnce(
        okJson({
          pr_id: 99,
          populate_status: "running",
          paths_populated: 0,
          populate_cost_usd: 1.5,
        })
      );
    const onTriggered = vi.fn();
    render(
      <RunPopulateButton
        prId={99}
        classifyStatus="done"
        populateStatus="pending"
        onTriggered={onTriggered}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /run kb_populate/i }));
    await waitFor(() =>
      expect(screen.getByText(/5 routes · ~\$1\.50/)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(onTriggered).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[1];
    expect(String(url)).toMatch(/\/admin\/pr-sync\/prs\/99\/populate$/);
    expect((init as RequestInit).method).toBe("POST");
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
