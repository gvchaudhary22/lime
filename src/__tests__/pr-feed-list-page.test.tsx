import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import type { FilterOptions, PrListResponse } from "@/types/pr-feed";

// ── mock next/navigation ──────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// ── mock Sidebar (pulls api.ts side-effects) ──────────────────────────────

vi.mock("@/components/layout/Sidebar", () => ({
  default: () => <aside data-testid="sidebar-mock" />,
}));

// ── mock aiplatformkb-api client ──────────────────────────────────────────

const mockListPrs = vi.fn();
const mockGetFilterOptions = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
      "@/lib/aiplatformkb-api"
    );
  return {
    ...actual,
    listPrs: (...args: unknown[]) => mockListPrs(...args),
    getFilterOptions: (...args: unknown[]) => mockGetFilterOptions(...args),
  };
});

// ── fixtures ──────────────────────────────────────────────────────────────

const BASE_OPTIONS: FilterOptions = {
  orgs: ["shiprocket", "other"],
  repos: ["MultiChannel_API"],
  authors: ["alice"],
  base_branches: ["develop"],
  domains: ["orders"],
  platforms: ["seller"],
};

function pageFixture(count: number): PrListResponse {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    sync_run_id: 1,
    pr_number: 1000 + i,
    pr_title: `test pr ${i + 1}`,
    pr_url: `https://github.com/BFRS-2/MultiChannel_API/pull/${1000 + i}`,
    pr_author: "alice",
    merged_at: "2026-04-23T10:00:00Z",
    merged_by: "reviewer",
    base_branch: "develop",
    changed_files: 3,
    processing_status: "done" as const,
    impact_counts: {
      impacted: 2,
      eligible_no_change: 1,
      deprecated_skipped: 0,
      new_pending: 0,
    },
  }));
  return { total: count, limit: 50, offset: 0, items };
}

// ── import AFTER mocks ────────────────────────────────────────────────────

import PrFeedListPage from "@/app/chat/pr-feed/page";

describe("PrFeedListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    localStorage.setItem("mars_token", "test");
    mockGetFilterOptions.mockResolvedValue(BASE_OPTIONS);
  });

  it("fetches listPrs and renders rows", async () => {
    mockListPrs.mockResolvedValueOnce(pageFixture(3));

    render(<PrFeedListPage />);

    await waitFor(() => {
      expect(mockListPrs).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("test pr 1")).toBeInTheDocument();
    });
    expect(screen.getByText("test pr 2")).toBeInTheDocument();
    expect(screen.getByText("test pr 3")).toBeInTheDocument();
  });

  it("renders empty state when no rows match", async () => {
    mockListPrs.mockResolvedValueOnce(pageFixture(0));

    render(<PrFeedListPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no prs match the current filters/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error banner on backend failure", async () => {
    mockListPrs.mockRejectedValueOnce(new Error("boom"));

    render(<PrFeedListPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-banner")).toHaveTextContent(/boom/);
  });

  it("changing Org dropdown refetches and updates URL querystring", async () => {
    mockListPrs.mockResolvedValue(pageFixture(0));

    render(<PrFeedListPage />);

    // Wait for initial fetch.
    await waitFor(() => {
      expect(mockListPrs).toHaveBeenCalledTimes(1);
    });

    // Change org.
    const orgSelect = screen.getByTestId("filter-org") as HTMLSelectElement;
    fireEvent.change(orgSelect, { target: { value: "shiprocket" } });

    // Debounced filter + URL update.
    await waitFor(() => {
      const calls = mockListPrs.mock.calls.filter(
        (c) => (c[0] as { org?: string })?.org === "shiprocket"
      );
      expect(calls.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      const urls = mockReplace.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("org=shiprocket"));
      expect(urls.length).toBeGreaterThan(0);
    });
  });
});
