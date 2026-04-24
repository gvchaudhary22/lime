import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import type { FilterOptions, PrDetailResponse } from "@/types/pr-feed";

// ── mocks ─────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => mockSearchParams,
  useParams: () => ({ prId: "42" }),
}));

vi.mock("@/components/layout/Sidebar", () => ({
  default: () => <aside data-testid="sidebar-mock" />,
}));

const mockGetPrDetail = vi.fn();
const mockGetFilterOptions = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
      "@/lib/aiplatformkb-api"
    );
  return {
    ...actual,
    getPrDetail: (...args: unknown[]) => mockGetPrDetail(...args),
    getFilterOptions: (...args: unknown[]) => mockGetFilterOptions(...args),
  };
});

// ── fixtures ──────────────────────────────────────────────────────────────

const BASE_OPTIONS: FilterOptions = {
  orgs: [],
  repos: [],
  authors: [],
  base_branches: [],
  domains: ["orders"],
  platforms: ["seller"],
};

function detailFixture(
  overrides: Partial<PrDetailResponse> = {}
): PrDetailResponse {
  return {
    pr: {
      id: 42,
      sync_run_id: 7,
      pr_number: 1234,
      pr_title: "fix: cancel-order race",
      pr_url: "https://github.com/BFRS-2/MultiChannel_API/pull/1234",
      pr_author: "alice",
      merged_at: "2026-04-23T10:00:00Z",
      merged_by: "reviewer",
      base_branch: "develop",
      head_branch: "feat/xyz",
      changed_files: 6,
      processing_status: "done",
      impact_counts: {
        impacted: 1,
        eligible_no_change: 0,
        deprecated_skipped: 0,
        new_pending: 0,
      },
      approved_by: ["bob"],
    },
    sync_run: {
      id: 7,
      started_at: "2026-04-23T09:00:00Z",
      finished_at: "2026-04-23T09:05:00Z",
      status: "done",
      routes_processed: 10,
      routes_skipped: 2,
      indirect_routes_processed: 3,
      kb_files_written: 9,
      db_rows_upserted: 9,
    },
    impacts: {
      total: 1,
      limit: 50,
      offset: 0,
      items: [
        {
          id: 901,
          http_path: "/orders/{id}/cancel",
          http_method: "POST",
          platform: "seller",
          domain: "orders",
          api_status: "existing",
          impact_status: "impacted",
          impact_type: "direct_route",
          changed_source_file: "app/Http/Controllers/OrderController.php",
          indirect_file_path: null,
          llm_model: "claude-sonnet-4-6",
          llm_confidence_score: 0.92,
          llm_impact_description: "cancellation path now checks pending state",
          llm_changed_functions: ["cancelOrder"],
          kb_file_path: "knowledge_base/.../cancel_order.json",
          kb_populated: 1,
          deprecation_state: "active",
        },
      ],
    },
    ...overrides,
  };
}

import PrFeedDetailPage from "@/app/chat/pr-feed/[prId]/page";

describe("PrFeedDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    localStorage.setItem("mars_token", "test");
    mockGetFilterOptions.mockResolvedValue(BASE_OPTIONS);
  });

  it("renders header + sync_run summary + first impact row", async () => {
    mockGetPrDetail.mockResolvedValueOnce(detailFixture());

    render(<PrFeedDetailPage />);

    await waitFor(() => {
      expect(mockGetPrDetail).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/fix: cancel-order race/i)
      ).toBeInTheDocument();
    });
    // Sync run summary card
    expect(screen.getByText(/Sync Run #7/)).toBeInTheDocument();
    // Impacts table row
    expect(screen.getByText("/orders/{id}/cancel")).toBeInTheDocument();
  });

  it("clicking the 'impacted' chip forwards impact_status to server + URL", async () => {
    mockGetPrDetail.mockResolvedValue(detailFixture());

    render(<PrFeedDetailPage />);
    await waitFor(() => expect(mockGetPrDetail).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId("impact-chip-impacted"));

    await waitFor(() => {
      const calls = mockGetPrDetail.mock.calls.filter((c) => {
        const filters = c[1] as {
          impact_status?: string[];
        };
        return filters?.impact_status?.includes("impacted");
      });
      expect(calls.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      const urls = mockReplace.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("impact_status=impacted"));
      expect(urls.length).toBeGreaterThan(0);
    });
  });

  it("min_confidence slider forwards value to the server call", async () => {
    mockGetPrDetail.mockResolvedValue(detailFixture());

    render(<PrFeedDetailPage />);
    await waitFor(() => expect(mockGetPrDetail).toHaveBeenCalledTimes(1));

    const slider = screen.getByTestId("min-confidence-slider");
    fireEvent.change(slider, { target: { value: "0.9" } });

    await waitFor(() => {
      const calls = mockGetPrDetail.mock.calls.filter((c) => {
        const filters = c[1] as { min_confidence?: number };
        return filters?.min_confidence === 0.9;
      });
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it("row click opens drawer with llm_impact_description", async () => {
    mockGetPrDetail.mockResolvedValueOnce(detailFixture());

    render(<PrFeedDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("/orders/{id}/cancel")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("/orders/{id}/cancel"));

    await waitFor(() => {
      expect(screen.getByTestId("drawer-description")).toHaveTextContent(
        /cancellation path now checks pending state/i
      );
    });
    // Drawer should be role=dialog.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
