// Phase-17 Wave 2B — ApisTab platform-scoped modules.
//
// Verifies the modules-fetch effect refetches `/admin/modules` whenever
// the selected platform changes (with `?platform=<value>`), and that
// the functional setModuleName updater either preserves the previous
// selection (when still present in the new platform's list) or falls
// to the first available module otherwise.
//
// Mirrors the mock pattern from src/__tests__/api-tools-tabs.test.tsx.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

const mockListAdminModules = vi.fn();
const mockListAdminOperations = vi.fn();
const mockGetOperationCounts = vi.fn();
const mockReorderOperations = vi.fn();
const mockSetOperationEligibility = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
    "@/lib/aiplatformkb-api"
  );
  return {
    ...actual,
    listAdminModules: (...a: unknown[]) => mockListAdminModules(...a),
    listAdminOperations: (...a: unknown[]) => mockListAdminOperations(...a),
    getOperationCounts: (...a: unknown[]) => mockGetOperationCounts(...a),
    reorderOperations: (...a: unknown[]) => mockReorderOperations(...a),
    setOperationEligibility: (...a: unknown[]) => mockSetOperationEligibility(...a),
  };
});

import ApisTab from "@/app/chat/api-tools/components/ApisTab";

beforeEach(() => {
  vi.clearAllMocks();
  // Counts endpoint resolves stably so the component mounts without
  // each test having to rewire it. Tests focused on the modules effect
  // do not assert on counts.
  mockGetOperationCounts.mockResolvedValue({
    platform: "seller_panel",
    total: 0,
    active: 0,
    deprecated: 0,
    by_module: {},
  });
  // Operations fetch can return empty by default — these tests focus on
  // the modules-fetch path. Tests can override with mockResolvedValueOnce
  // if they need specific operation rows. mockResolvedValue (not Once)
  // so re-renders triggered by platform change still find a resolved
  // promise instead of an unhandled undefined.
  mockListAdminOperations.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

// Helper — finds the Module <select> by its label text.
function getModuleSelect(): HTMLSelectElement {
  // Module select is the second <label>-wrapped select in the toolbar.
  // The label text is "Module " (with trailing nbsp); match by role+name.
  const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
  // Order in render: Platform select, Module select, api_usable filter.
  return selects[1];
}

function getPlatformSelect(): HTMLSelectElement {
  const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
  return selects[0];
}

describe("ApisTab — Phase-17 platform-scoped modules", () => {
  it("refetches modules when platform changes and passes ?platform=<value>", async () => {
    // Initial mount — default platform is "seller_panel".
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders",          display_order: 10 },
      { module_name: "Auth",  display_name: "Authentication", display_order: 20 },
    ]);
    render(<ApisTab />);

    await waitFor(() => {
      // First call: with the initial default platform.
      expect(mockListAdminModules).toHaveBeenCalledWith("seller_panel");
    });
    // Both modules show up in the dropdown.
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Order" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Auth" })).toBeInTheDocument();
    });

    // User switches platform → second fetch with new platform.
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Tracking", display_name: "Tracking", display_order: 10 },
    ]);
    fireEvent.change(getPlatformSelect(), { target: { value: "icrm_platform" } });

    await waitFor(() => {
      expect(mockListAdminModules).toHaveBeenCalledWith("icrm_platform");
    });
    // New platform's modules render; the old ones are gone.
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tracking" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: "Auth" })).not.toBeInTheDocument();
    // Module fetch should have been called exactly twice (mount + change).
    expect(mockListAdminModules).toHaveBeenCalledTimes(2);
  });

  it("resets moduleName when previously-selected module is absent in new platform list", async () => {
    // Mount: Order + Auth. After mount the functional updater seeds
    // moduleName with "Order" (first row).
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders",          display_order: 10 },
      { module_name: "Auth",  display_name: "Authentication", display_order: 20 },
    ]);
    render(<ApisTab />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Auth" })).toBeInTheDocument();
    });
    // User selects "Auth".
    fireEvent.change(getModuleSelect(), { target: { value: "Auth" } });
    expect(getModuleSelect().value).toBe("Auth");

    // User switches platform to one that has no Auth module.
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders", display_order: 10 },
    ]);
    fireEvent.change(getPlatformSelect(), { target: { value: "srx" } });

    await waitFor(() => {
      expect(mockListAdminModules).toHaveBeenCalledWith("srx");
    });
    // moduleName should fall to the first available — "Order".
    await waitFor(() => {
      expect(getModuleSelect().value).toBe("Order");
    });
    // And "Auth" is no longer an option.
    expect(screen.queryByRole("option", { name: "Auth" })).not.toBeInTheDocument();
  });

  it("preserves moduleName when the same module exists in the new platform's list", async () => {
    // Mount with Order + Auth.
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order", display_name: "Orders",          display_order: 10 },
      { module_name: "Auth",  display_name: "Authentication", display_order: 20 },
    ]);
    render(<ApisTab />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Order" })).toBeInTheDocument();
    });
    // Default selection is "Order" (first row from the mounted list).
    fireEvent.change(getModuleSelect(), { target: { value: "Order" } });
    expect(getModuleSelect().value).toBe("Order");

    // Switch platform to one that still has Order (plus a new module).
    mockListAdminModules.mockResolvedValueOnce([
      { module_name: "Order",    display_name: "Orders",   display_order: 10 },
      { module_name: "Tracking", display_name: "Tracking", display_order: 20 },
    ]);
    fireEvent.change(getPlatformSelect(), { target: { value: "icrm_platform" } });

    await waitFor(() => {
      expect(mockListAdminModules).toHaveBeenCalledWith("icrm_platform");
    });
    // Selection survives the platform switch.
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tracking" })).toBeInTheDocument();
    });
    expect(getModuleSelect().value).toBe("Order");
  });
});
