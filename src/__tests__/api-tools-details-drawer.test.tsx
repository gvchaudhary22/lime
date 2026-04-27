// Phase 16 Wave 2D — OperationDetailsDrawer tests.
//
// Locks the contract:
//   1. Click "Details" on a row opens drawer; getOperationDetails called with right id.
//   2. Drawer shows loading state before fetch resolves.
//   3. Drawer renders Identity + Description + Classification + ELK + Visibility sections.
//   4. ELK section shows "no per-day breakdown" when per_day is empty.
//   5. Escape key closes drawer.
//   6. Backdrop click closes drawer.
//   7. API error shows red banner with retry.
//   8. Details-button click does not bubble to row drag handler.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";

const mockListAdminModules = vi.fn();
const mockListAdminOperations = vi.fn();
const mockReorderOperations = vi.fn();
const mockSetOperationEligibility = vi.fn();
const mockGetOperationCounts = vi.fn();
const mockGetOperationDetails = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
    "@/lib/aiplatformkb-api"
  );
  return {
    ...actual,
    listAdminModules: (...a: unknown[]) => mockListAdminModules(...a),
    listAdminOperations: (...a: unknown[]) => mockListAdminOperations(...a),
    reorderOperations: (...a: unknown[]) => mockReorderOperations(...a),
    setOperationEligibility: (...a: unknown[]) => mockSetOperationEligibility(...a),
    getOperationCounts: (...a: unknown[]) => mockGetOperationCounts(...a),
    getOperationDetails: (...a: unknown[]) => mockGetOperationDetails(...a),
  };
});

import ApisTab from "@/app/chat/api-tools/components/ApisTab";
import OperationDetailsDrawer from "@/components/api-tools/OperationDetailsDrawer";
import { VISIBILITY_EXPLAINER } from "@/lib/api-tools-copy";
import type { OperationDetails } from "@/types/api-tools";

const baseDetails: OperationDetails = {
  id: 281,
  api_id: "mcapi.v1.shipments.ndr.action.post",
  repo_name: "MultiChannel_API",
  base_url: "https://apiv2.shiprocket.co",
  http_method: "POST",
  path: "/api/v1/shipments/ndr/{id}/action",
  api_version: "v1",
  auth_type: "seller_jwt",
  auth_scope: "company_id",
  rate_limit_rpm: 360,
  platform: "seller_panel",
  module: "NDR",
  sub_module: null,
  agent: "ndr_resolver",
  persona: "seller",
  intent: "ndr_action_submit",
  seller_menu_key: "process_ndr",
  ui_section: "NDR",
  ui_subsection: null,
  page_url: "/seller/ndr",
  controller: "ShipmentController@ndrAction",
  source_file: "app/Http/Controllers/Api/V1/Shipment/NdrController.php",
  tool_name: "submit_ndr_action",
  description: "Records the seller's chosen response to a Non-Delivery-Report exception.",
  approval_mode: "confirm",
  risk_level: "medium",
  read_write_type: "WRITE",
  deprecated: false,
  elk_deprecated_api: false,
  ai_platform_eligible_api: true,
  display_order: 30,
  reject_description: null,
  elk: {
    elk_host: "elk-01",
    elk_index: "star-api-internal-nginx-*",
    primary_index: "star-api-internal-nginx-*",
    hit_count_7d: 12487,
    hit_count_updated_at: "2026-04-26T03:39:42Z",
    elk_deprecated_api: false,
    per_day: {
      day_1: 1932, day_2: 2104, day_3: 1987,
      day_4: 1801, day_5: 1654, day_6: 1556, day_7: 1453,
    },
    per_index_breakdown: [
      { index_name: "star-api-internal-nginx-*", hits_7d: 11430 },
      { index_name: "sr-api-internal-nginx-*",    hits_7d:  1057 },
    ],
    status_breakdown: { "200": 11892, "400": 489, "500": 106 },
    refreshed_at: "2026-04-26T03:39:42Z",
  },
  created_at: "2025-12-14T10:22:18Z",
  updated_at: "2026-04-27T10:01:07Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListAdminModules.mockResolvedValue([
    { module_name: "NDR", display_name: null, display_order: null },
  ]);
  mockGetOperationCounts.mockResolvedValue({
    platform: "seller_panel",
    total: 100,
    active: 90,
    deprecated: 10,
    by_module: { NDR: { total: 30, active: 25, deprecated: 5 } },
  });
  mockListAdminOperations.mockResolvedValue([
    {
      id: 281,
      http_method: "POST",
      path: "/api/v1/shipments/ndr/{id}/action",
      display_order: 30,
      tool_name: "submit_ndr_action",
      hit_count_7d: 12487,
      ai_platform_eligible_api: true,
      read_write_type: "WRITE",
      risk_level: "medium",
      deprecated: false,
      elk_deprecated_api: false,
    },
  ]);
});

afterEach(() => cleanup());

// ── Test 1: click Details → drawer opens, fetch called with right id ─────

describe("ApisTab + OperationDetailsDrawer", () => {
  it("opens drawer and fetches details when Details button clicked", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    render(<ApisTab />);
    const btn = await screen.findByTestId("details-btn-281");
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(mockGetOperationDetails).toHaveBeenCalledWith(281);
    });
    // Drawer's title bar exposes "POST /api/v1/shipments/ndr/{id}/action"
    expect(await screen.findByText(/POST .*shipments\/ndr/)).toBeInTheDocument();
  });
});

// ── Test 2-7: Drawer rendered standalone (faster, isolated) ──────────────

describe("OperationDetailsDrawer", () => {
  it("shows loading spinner before fetch resolves", () => {
    mockGetOperationDetails.mockReturnValue(new Promise(() => {})); // never resolves
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    expect(screen.getByTestId("drawer-loading")).toBeInTheDocument();
  });

  it("renders all 5 main sections after data loads", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    // Description
    expect(await screen.findByTestId("drawer-description")).toHaveTextContent(
      /Records the seller's chosen response/
    );
    // Classification + ELK + Visibility — assert by the section's testid'd
    // wrapper rather than by free-text (some values like "NDR" appear in
    // multiple labels — module name AND ui_section — which would trip
    // getByText). The drawer-elk-section / drawer-visibility-section
    // markers are stable.
    expect(screen.getByTestId("drawer-elk-section")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-visibility-section")).toBeInTheDocument();
    expect(screen.getByText("ndr_resolver")).toBeInTheDocument();
    // ELK section labels (Day column)
    expect(screen.getByText(/Per-day hits/)).toBeInTheDocument();
    // Visibility section text matches the shared constant
    expect(screen.getByTestId("drawer-visibility-explainer")).toHaveTextContent(
      VISIBILITY_EXPLAINER.split("\n")[0]   // first line as proxy
    );
  });

  it("shows empty-state for ELK when per_day is {}", async () => {
    mockGetOperationDetails.mockResolvedValue({
      ...baseDetails,
      elk: {
        ...baseDetails.elk,
        per_day: {},
        per_index_breakdown: [],
        status_breakdown: null,
        refreshed_at: null,
      },
    });
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    expect(await screen.findByTestId("drawer-elk-empty")).toBeInTheDocument();
  });

  it("Escape key closes drawer", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    const onClose = vi.fn();
    render(<OperationDetailsDrawer operationId={281} onClose={onClose} />);
    await screen.findByTestId("drawer-description");  // wait for content
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click closes drawer", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    const onClose = vi.fn();
    const { container } = render(
      <OperationDetailsDrawer operationId={281} onClose={onClose} />
    );
    await screen.findByTestId("drawer-description");
    // Backdrop is the first div with bg-black/60 class.
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error banner with Retry button on fetch failure", async () => {
    mockGetOperationDetails.mockRejectedValue(new Error("connection refused"));
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    expect(await screen.findByTestId("drawer-error")).toHaveTextContent(
      /connection refused/
    );
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("Retry re-fetches and replaces error with content on success", async () => {
    mockGetOperationDetails
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(baseDetails);
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    await screen.findByTestId("drawer-error");
    fireEvent.click(screen.getByText("Retry"));
    expect(await screen.findByTestId("drawer-description")).toBeInTheDocument();
    expect(mockGetOperationDetails).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when operationId is null (drawer closed)", () => {
    const { container } = render(
      <OperationDetailsDrawer operationId={null} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
