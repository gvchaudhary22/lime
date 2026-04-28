// Phase 12 Wave 3-LIME-D — tab write-back tests.
// Verifies the Save buttons issue the right reorder POST + that errors
// roll back local state to the last server-confirmed order.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";

// Phase 19 — ApisTab now uses useRouter() to navigate to /chat/api-tools/
// reclassify/[id]. Stub the App Router context so the tests don't trip the
// "invariant expected app router to be mounted" runtime check.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

const mockListAdminModules = vi.fn();
const mockReorderModules = vi.fn();
const mockListAdminOperations = vi.fn();
const mockReorderOperations = vi.fn();
const mockSetOperationEligibility = vi.fn();
const mockGetOperationCounts = vi.fn();
const mockListTools = vi.fn();
const mockGetToolApis = vi.fn();
const mockCreateTool = vi.fn();
const mockArchiveTool = vi.fn();
const mockReorderToolApis = vi.fn();
const mockRemoveApiFromTool = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
    "@/lib/aiplatformkb-api"
  );
  return {
    ...actual,
    listAdminModules: (...a: unknown[]) => mockListAdminModules(...a),
    reorderModules: (...a: unknown[]) => mockReorderModules(...a),
    listAdminOperations: (...a: unknown[]) => mockListAdminOperations(...a),
    reorderOperations: (...a: unknown[]) => mockReorderOperations(...a),
    setOperationEligibility: (...a: unknown[]) => mockSetOperationEligibility(...a),
    getOperationCounts: (...a: unknown[]) => mockGetOperationCounts(...a),
    listTools: (...a: unknown[]) => mockListTools(...a),
    getToolApis: (...a: unknown[]) => mockGetToolApis(...a),
    createTool: (...a: unknown[]) => mockCreateTool(...a),
    archiveTool: (...a: unknown[]) => mockArchiveTool(...a),
    reorderToolApis: (...a: unknown[]) => mockReorderToolApis(...a),
    removeApiFromTool: (...a: unknown[]) => mockRemoveApiFromTool(...a),
  };
});

import ModulesTab from "@/app/chat/api-tools/components/ModulesTab";
import ApisTab from "@/app/chat/api-tools/components/ApisTab";
import ToolsTab from "@/app/chat/api-tools/components/ToolsTab";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: counts endpoint returns a stable shape so ApisTab can mount
  // without a separate setup line in every test. Tests that care about
  // specific numbers override with mockResolvedValueOnce.
  mockGetOperationCounts.mockResolvedValue({
    platform: "seller_panel",
    total: 357,
    active: 258,
    deprecated: 99,
    by_module: { Order: { total: 119, active: 98, deprecated: 21 } },
  });
});

afterEach(() => {
  cleanup();
});

// ── ModulesTab ─────────────────────────────────────────────────────────

describe("ModulesTab", () => {
  it("renders fetched modules in order", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Auth", display_name: "Authentication", display_order: 10 },
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    render(<ModulesTab />);
    await waitFor(() => {
      expect(screen.getByText("Authentication")).toBeInTheDocument();
      expect(screen.getByText("Orders")).toBeInTheDocument();
    });
  });

  it("Save button stays disabled until local order differs from server order", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Auth", display_name: "Authentication", display_order: 10 },
    ]);
    render(<ModulesTab />);
    await waitFor(() => {
      expect(screen.getByText("Authentication")).toBeInTheDocument();
    });
    const saveBtn = screen.getByRole("button", { name: /Save order/i });
    expect(saveBtn).toBeDisabled();
  });

  it("shows error inline if list fetch fails", async () => {
    mockListAdminModules.mockRejectedValueOnce(new Error("network down"));
    render(<ModulesTab />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load modules/i)).toBeInTheDocument();
      expect(screen.getByText(/network down/i)).toBeInTheDocument();
    });
  });
});

// ── ApisTab ────────────────────────────────────────────────────────────

describe("ApisTab", () => {
  it("loads modules then operations for default platform/module", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([
      { id: 1, http_method: "GET", path: "/api/v1/orders/show/{id}", display_order: null, tool_name: null, hit_count_7d: 100, ai_platform_eligible_api: true, read_write_type: "READ", risk_level: "low", deprecated: false, elk_deprecated_api: false },
    ]);
    render(<ApisTab />);
    await waitFor(() => {
      expect(mockListAdminOperations).toHaveBeenCalledWith({
        platform: "seller_panel",
        module: "Order",
      });
      expect(screen.getByText("/api/v1/orders/show/{id}")).toBeInTheDocument();
    });
  });

  it("Save button disabled when no drag has happened", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([
      { id: 1, http_method: "GET", path: "/api/v1/orders/show/{id}", display_order: null, tool_name: null, hit_count_7d: 100, ai_platform_eligible_api: true, read_write_type: "READ", risk_level: "low", deprecated: false, elk_deprecated_api: false },
    ]);
    render(<ApisTab />);
    await waitFor(() => screen.getByText("/api/v1/orders/show/{id}"));
    expect(screen.getByRole("button", { name: /Save order/i })).toBeDisabled();
  });

  it("shows error when listAdminOperations fails", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockRejectedValueOnce(new Error("DB down"));
    render(<ApisTab />);
    await waitFor(() => {
      expect(screen.getByText(/DB down/i)).toBeInTheDocument();
    });
  });

  it("deprecated rows hidden by default; toggle reveals + adds badge", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([
      // Active row — should always be visible.
      { id: 1, http_method: "GET",  path: "/api/v1/orders/active",     display_order: null, tool_name: null, hit_count_7d: 100, ai_platform_eligible_api: true, read_write_type: "READ", risk_level: "low", deprecated: false, elk_deprecated_api: false },
      // ELK-derived deprecated — hidden by default.
      { id: 2, http_method: "GET",  path: "/api/v1/orders/dead-route", display_order: null, tool_name: null, hit_count_7d: 0,   ai_platform_eligible_api: false, read_write_type: "READ", risk_level: "low", deprecated: false, elk_deprecated_api: true },
      // Curator-marked deprecated — hidden by default.
      { id: 3, http_method: "POST", path: "/api/v1/orders/old-flow",   display_order: null, tool_name: null, hit_count_7d: 5,   ai_platform_eligible_api: false, read_write_type: "WRITE", risk_level: "low", deprecated: true,  elk_deprecated_api: false },
    ]);
    render(<ApisTab />);
    await waitFor(() => screen.getByText("/api/v1/orders/active"));
    // Default: only the active row visible.
    expect(screen.getByText("/api/v1/orders/active")).toBeInTheDocument();
    expect(screen.queryByText("/api/v1/orders/dead-route")).not.toBeInTheDocument();
    expect(screen.queryByText("/api/v1/orders/old-flow")).not.toBeInTheDocument();
    // Toggle "Show deprecated" — deprecated rows appear with badge.
    fireEvent.click(screen.getByLabelText(/Show deprecated/i));
    await waitFor(() => screen.getByText("/api/v1/orders/dead-route"));
    expect(screen.getByText("/api/v1/orders/old-flow")).toBeInTheDocument();
    // 2 deprecated badges rendered (one per deprecated row).
    expect(screen.getAllByText(/^deprecated$/i).length).toBe(2);
  });

  it("renders left counts panel populated from getOperationCounts", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([]);
    // beforeEach default mocks counts → platform 357 / 258 active / 99 dep
    //                                   module Order 119 / 98 / 21
    render(<ApisTab />);
    await waitFor(() => {
      expect(screen.getByText("357")).toBeInTheDocument();   // platform total
      expect(screen.getByText("258")).toBeInTheDocument();   // platform active
      expect(screen.getByText("99 dep")).toBeInTheDocument(); // platform deprecated
      expect(screen.getByText("119")).toBeInTheDocument();   // module total
      expect(screen.getByText("98")).toBeInTheDocument();    // module active
      expect(screen.getByText("21 dep")).toBeInTheDocument(); // module deprecated
    });
  });

  // Phase 19 — Reclassify button surfaces between Details and visibility
  // toggle. Asserts presence + testid; the navigation behaviour itself is
  // covered by the dedicated reclassify-page test suite.
  it("renders a Reclassify button per row with the correct testid", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([
      {
        id: 1744,
        http_method: "POST",
        path: "/api/v1/auth/logout",
        display_order: null,
        tool_name: "auth_logout",
        hit_count_7d: 64378,
        ai_platform_eligible_api: false,
        read_write_type: "WRITE",
        risk_level: "medium",
        deprecated: false,
        elk_deprecated_api: false,
      },
    ]);
    render(<ApisTab />);
    await waitFor(() => screen.getByText("/api/v1/auth/logout"));
    const reclassifyBtn = screen.getByTestId("reclassify-btn-1744");
    expect(reclassifyBtn).toBeInTheDocument();
    expect(reclassifyBtn).toHaveTextContent(/Reclassify/i);
  });

  it("eligibility toggle flips the per-row state and posts PATCH", async () => {
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 20 },
    ]);
    mockListAdminOperations.mockResolvedValueOnce([
      {
        id: 1744,
        http_method: "POST",
        path: "/api/v1/auth/logout",
        display_order: null,
        tool_name: "auth_logout",
        hit_count_7d: 64378,
        ai_platform_eligible_api: false,
        read_write_type: "WRITE",
        risk_level: "medium",
        deprecated: false,
        elk_deprecated_api: false,
      },
    ]);
    mockSetOperationEligibility.mockResolvedValueOnce({
      id: 1744,
      ai_platform_eligible_api: true,
    });
    render(<ApisTab />);
    await waitFor(() => screen.getByText("/api/v1/auth/logout"));
    // Pre-click — row label says "hidden". Target via title attribute
    // because dnd-kit wraps the whole row in a role=button for keyboard
    // accessibility, so getByRole("button") would be ambiguous. Phase-16
    // shifted the tooltip wording from "Hidden from /docs/ai-platform"
    // to "Hidden from the AI agent" (sourced from the shared
    // src/lib/api-tools-copy.ts visibilityTooltip helper).
    expect(screen.getByText("hidden")).toBeInTheDocument();
    const toggleBtn = screen.getByTitle(/Hidden from the AI agent/i);
    fireEvent.click(toggleBtn);
    // Optimistic flip — label switches to "visible" before the await resolves.
    expect(screen.getByText("visible")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockSetOperationEligibility).toHaveBeenCalledWith(1744, { eligible: true });
    });
  });
});

// ── ToolsTab ───────────────────────────────────────────────────────────

describe("ToolsTab", () => {
  it("loads tools list + members of the first tool", async () => {
    mockListTools.mockResolvedValueOnce([
      { id: 7, name: "OrdersTool", description: "x", display_order: 10, status: "active" },
    ]);
    mockGetToolApis.mockResolvedValueOnce([
      { api_listing_id: 100, http_method: "GET", path: "/api/v1/orders", tool_name: "tool_a", position: 10 },
    ]);
    render(<ToolsTab />);
    await waitFor(() => {
      // "OrdersTool" appears twice (list row + right-pane h3), so use getAllByText.
      expect(screen.getAllByText("OrdersTool").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("/api/v1/orders")).toBeInTheDocument();
    });
  });

  it("shows New-tool form when '+ New tool' is clicked + submits createTool", async () => {
    mockListTools.mockResolvedValueOnce([]);
    mockCreateTool.mockResolvedValueOnce({
      id: 11, name: "MyNewTool", description: null, display_order: 10, status: "draft",
    });
    // After create, refresh fires another listTools.
    mockListTools.mockResolvedValueOnce([
      { id: 11, name: "MyNewTool", description: null, display_order: 10, status: "draft" },
    ]);
    mockGetToolApis.mockResolvedValueOnce([]);

    render(<ToolsTab />);
    await waitFor(() => screen.getByText(/No tools in this filter/i));

    fireEvent.click(screen.getByRole("button", { name: /New tool/i }));
    fireEvent.change(screen.getByPlaceholderText(/tool name/i), {
      target: { value: "MyNewTool" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Create draft/i }));
    });
    expect(mockCreateTool).toHaveBeenCalledWith({
      name: "MyNewTool",
      description: null,
    });
  });

  it("filter chips switch displayed status", async () => {
    mockListTools.mockResolvedValueOnce([
      { id: 1, name: "ActiveTool",   description: null, display_order: 10, status: "active" },
      { id: 2, name: "ArchivedTool", description: null, display_order: 20, status: "archived" },
    ]);
    mockGetToolApis.mockResolvedValueOnce([]);
    render(<ToolsTab />);
    // "ActiveTool" appears in both the list-row AND the right-pane h3
    // (selected state). Use getAllByText with length checks.
    await waitFor(() => {
      expect(screen.getAllByText("ActiveTool").length).toBeGreaterThanOrEqual(1);
    });
    // Default "All" → both visible.
    expect(screen.getByText("ArchivedTool")).toBeInTheDocument();
    // Click "Active" filter chip.
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getAllByText("ActiveTool").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("ArchivedTool")).not.toBeInTheDocument();
  });
});
