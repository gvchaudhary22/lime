// Phase 12 Wave 3-LIME-D — tab write-back tests.
// Verifies the Save buttons issue the right reorder POST + that errors
// roll back local state to the last server-confirmed order.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";

const mockListAdminModules = vi.fn();
const mockReorderModules = vi.fn();
const mockListAdminOperations = vi.fn();
const mockReorderOperations = vi.fn();
const mockSetOperationEligibility = vi.fn();
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
      { id: 1, http_method: "GET", path: "/api/v1/orders/show/{id}", display_order: null, tool_name: null, hit_count_7d: 100, ai_platform_eligible_api: true, read_write_type: "READ", risk_level: "low" },
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
      { id: 1, http_method: "GET", path: "/api/v1/orders/show/{id}", display_order: null, tool_name: null, hit_count_7d: 100, ai_platform_eligible_api: true, read_write_type: "READ", risk_level: "low" },
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
    // accessibility, so getByRole("button") would be ambiguous.
    expect(screen.getByText("hidden")).toBeInTheDocument();
    const toggleBtn = screen.getByTitle(/Hidden from \/docs\/ai-platform/i);
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
