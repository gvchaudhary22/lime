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

// Phase 19 — ApisTab now uses useRouter() for the Reclassify-button
// navigation. Stub the App Router context so this test (which mounts
// ApisTab once) doesn't trip the App Router invariant.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

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
  module_curated: false,
  agent_curated: false,
  persona_curated: false,
  platform_curated: false,
  display_order: 30,
  reject_description: null,
  elk: {
    elk_host: "elk-01",
    elk_index: "star-api-internal-nginx-*",
    hit_count_7d: 12487,
    hit_count_updated_at: "2026-04-26T03:39:42Z",
    elk_deprecated_api: false,
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

  it("renders all main sections after data loads", async () => {
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
    // ELK section surfaces the api_listing-derived summary fields
    expect(screen.getByText("elk_host")).toBeInTheDocument();
    expect(screen.getByText("hit_count_7d")).toBeInTheDocument();
    // Visibility section text matches the shared constant
    expect(screen.getByTestId("drawer-visibility-explainer")).toHaveTextContent(
      VISIBILITY_EXPLAINER.split("\n")[0]   // first line as proxy
    );
  });

  it("renders ELK summary as null when refresh pipeline never ran", async () => {
    mockGetOperationDetails.mockResolvedValue({
      ...baseDetails,
      elk: {
        elk_host: null,
        elk_index: null,
        hit_count_7d: null,
        hit_count_updated_at: null,
        elk_deprecated_api: false,
      },
    });
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    // Drawer mounts; ELK section is rendered with em-dashes for the
    // null api_listing fields rather than crashing.
    expect(await screen.findByTestId("drawer-elk-section")).toBeInTheDocument();
    expect(screen.getByText("elk_host")).toBeInTheDocument();
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

  // TS-M3 — race coverage. While the first fetch is in-flight, the parent
  // re-mounts the drawer with a different operationId. The alive-guard
  // must drop the stale promise so the second op's data wins, regardless
  // of resolution order.
  it("alive-guard drops stale fetch when operationId changes mid-flight", async () => {
    let resolveFirst!: (v: OperationDetails) => void;
    const firstPromise = new Promise<OperationDetails>((res) => {
      resolveFirst = res;
    });
    const secondDetails: OperationDetails = {
      ...baseDetails,
      id: 999,
      api_id: "mcapi.v1.shipments.other.get",
      http_method: "GET",
      path: "/api/v1/other",
      description: "Second operation description.",
    };
    mockGetOperationDetails
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(secondDetails);

    const { rerender } = render(
      <OperationDetailsDrawer operationId={281} onClose={() => {}} />
    );
    expect(screen.getByTestId("drawer-loading")).toBeInTheDocument();

    // Switch to the second operation while the first promise is still pending.
    rerender(<OperationDetailsDrawer operationId={999} onClose={() => {}} />);
    await screen.findByText(/Second operation description/);

    // Now resolve the first (stale) promise. The drawer must NOT swap to
    // the first operation's content.
    await act(async () => {
      resolveFirst(baseDetails);
      await Promise.resolve();
    });
    expect(screen.getByText(/Second operation description/)).toBeInTheDocument();
    expect(screen.queryByText(/Records the seller's chosen response/)).toBeNull();
  });

  // Phase 19 — manual-override lock badges next to module/agent/persona.
  it("renders manual-override badges when curated flags are true", async () => {
    mockGetOperationDetails.mockResolvedValue({
      ...baseDetails,
      module_curated: true,
      agent_curated: false,
      persona_curated: true,
    });
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    await screen.findByTestId("drawer-description");
    expect(screen.getByTestId("drawer-module-lock-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("drawer-agent-lock-badge")).toBeNull();
    expect(screen.getByTestId("drawer-persona-lock-badge")).toBeInTheDocument();
  });

  // Phase 19 amendment — platform also surfaces a lock badge when
  // platform_curated is true (curator pinned the platform via the
  // Reclassify page; populate_kb won't clobber it on future syncs).
  it("renders platform lock badge when platform_curated is true", async () => {
    mockGetOperationDetails.mockResolvedValue({
      ...baseDetails,
      platform_curated: true,
    });
    render(<OperationDetailsDrawer operationId={281} onClose={() => {}} />);
    await screen.findByTestId("drawer-description");
    expect(screen.getByTestId("drawer-platform-lock-badge")).toBeInTheDocument();
  });
});
