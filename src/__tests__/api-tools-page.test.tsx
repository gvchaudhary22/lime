// Phase 12 Wave 3-LIME-B — page scaffold tests.
// Mocks next/navigation + Sidebar + aiplatformkb-api client.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/components/layout/Sidebar", () => ({
  default: () => <aside data-testid="sidebar-mock" />,
}));

const mockListAdminModules = vi.fn();
const mockListAdminOperations = vi.fn();
const mockListTools = vi.fn();
const mockGetToolApis = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
    "@/lib/aiplatformkb-api"
  );
  return {
    ...actual,
    listAdminModules: (...args: unknown[]) => mockListAdminModules(...args),
    listAdminOperations: (...args: unknown[]) => mockListAdminOperations(...args),
    listTools: (...args: unknown[]) => mockListTools(...args),
    getToolApis: (...args: unknown[]) => mockGetToolApis(...args),
  };
});

import ApiToolsPage from "@/app/chat/api-tools/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockListAdminModules.mockResolvedValue([
    { module_name: "Auth", display_name: "Authentication", display_order: 10 },
    { module_name: "Order", display_name: "Orders", display_order: 20 },
  ]);
  mockListAdminOperations.mockResolvedValue([]);
  mockListTools.mockResolvedValue([]);
  mockGetToolApis.mockResolvedValue([]);
});

// ── Test 1: page renders + defaults to Modules tab ───────────────────────

it("renders header + tab strip + Modules tab by default", async () => {
  render(<ApiToolsPage />);
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /API Tools/i })).toBeInTheDocument();
  });
  // Tab strip has all three tabs.
  expect(screen.getByRole("tab", { name: "Modules" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "APIs" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Tools" })).toBeInTheDocument();
  // Modules tab is the default — fetched modules client-side.
  await waitFor(() => {
    expect(mockListAdminModules).toHaveBeenCalled();
  });
});

// ── Test 2: tab clicks update URL via router.replace ─────────────────────

it("clicking a tab calls router.replace with ?tab=…", async () => {
  render(<ApiToolsPage />);
  await waitFor(() => {
    expect(screen.getByRole("tab", { name: "Tools" })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
  expect(mockReplace).toHaveBeenCalledWith(
    expect.stringMatching(/\/chat\/api-tools\?.*tab=tools/),
  );
});

// ── Test 3: ?tab=tools URL param renders the Tools tab ───────────────────

it("respects ?tab=tools URL param on initial render", async () => {
  mockSearchParams = new URLSearchParams("tab=tools");
  render(<ApiToolsPage />);
  // Tools tab loads → listTools() called.
  await waitFor(() => {
    expect(mockListTools).toHaveBeenCalled();
  });
});

// ── Test 4: error from a tab surfaces inline (not a crash) ───────────────

it("surfaces an API error in the Modules tab without crashing the page", async () => {
  mockListAdminModules.mockRejectedValueOnce(new Error("boom — mars down"));
  render(<ApiToolsPage />);
  await waitFor(() => {
    expect(screen.getByText(/Failed to load modules/i)).toBeInTheDocument();
    expect(screen.getByText(/boom — mars down/i)).toBeInTheDocument();
  });
  // Page header is still rendered — error is per-tab, not page-level.
  expect(screen.getByRole("heading", { name: /API Tools/i })).toBeInTheDocument();
});
