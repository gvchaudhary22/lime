// Phase 19 Wave 2B — Reclassify page tests.
//
// Locks the 8 contract points from PHASE-19-PLAN.md §7.5.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import React from "react";

const mockReplace = vi.fn();
const mockBack = vi.fn();
const mockPush = vi.fn();
let mockParams: { id?: string } = { id: "281" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
  useParams: () => mockParams,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/Sidebar", () => ({
  default: () => <aside data-testid="sidebar-mock" />,
}));

const mockGetOperationDetails = vi.fn();
const mockGetOperationSuggest = vi.fn();
const mockListAdminModules = vi.fn();
const mockListAdminPlatforms = vi.fn();
const mockListAdminAgents = vi.fn();
const mockSetOperationClassification = vi.fn();

vi.mock("@/lib/aiplatformkb-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiplatformkb-api")>(
    "@/lib/aiplatformkb-api",
  );
  return {
    ...actual,
    getOperationDetails: (...a: unknown[]) => mockGetOperationDetails(...a),
    getOperationSuggest: (...a: unknown[]) => mockGetOperationSuggest(...a),
    listAdminModules: (...a: unknown[]) => mockListAdminModules(...a),
    listAdminPlatforms: (...a: unknown[]) => mockListAdminPlatforms(...a),
    listAdminAgents: (...a: unknown[]) => mockListAdminAgents(...a),
    setOperationClassification: (...a: unknown[]) =>
      mockSetOperationClassification(...a),
  };
});

import ReclassifyPage from "@/app/chat/api-tools/reclassify/[id]/page";
import type { OperationDetails, OperationSuggest } from "@/types/api-tools";

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
  module: "Order",
  sub_module: null,
  agent: "shipment_ops",
  persona: "seller",
  intent: null,
  seller_menu_key: null,
  ui_section: null,
  ui_subsection: null,
  page_url: null,
  controller: "ShipmentController@ndrAction",
  source_file: "app/Http/Controllers/Api/V1/Shipment/NdrController.php",
  tool_name: null,
  description: "Records the seller's chosen response.",
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
    elk_host: null,
    elk_index: null,
    hit_count_7d: null,
    hit_count_updated_at: null,
    elk_deprecated_api: false,
  },
  created_at: null,
  updated_at: null,
};

const happySuggest: OperationSuggest = {
  module: "NDR",
  agent: "ndr_resolver",
  persona: "seller",
  current: { module: "Order", agent: "shipment_ops", persona: "seller" },
  reasoning:
    "Path /api/v1/shipments/ndr/{id}/action and controller " +
    "ShipmentController@ndrAction indicate an NDR action.",
  model: "claude-haiku-4-5-20251001",
  input_tokens: 1842,
  output_tokens: 187,
  latency_ms: 1340,
  fallback: false,
};

const fallbackSuggest: OperationSuggest = {
  module: null,
  agent: null,
  persona: null,
  current: { module: "Order", agent: "shipment_ops", persona: "seller" },
  reasoning: "AI suggestion unavailable — pick manually",
  model: "claude-haiku-4-5-20251001",
  input_tokens: 0,
  output_tokens: 0,
  latency_ms: 0,
  fallback: true,
};

const baseModules = [
  { module_name: "NDR", display_name: "NDR", display_order: 5 },
  { module_name: "Order", display_name: "Orders", display_order: 10 },
  { module_name: "Shipment", display_name: "Shipment", display_order: 15 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockParams = { id: "281" };
  mockListAdminModules.mockResolvedValue(baseModules);
  mockListAdminPlatforms.mockResolvedValue([
    "icrm_platform",
    "seller_panel",
    "srx",
  ]);
  mockListAdminAgents.mockResolvedValue(["ndr_resolver", "shipment_ops"]);
});

afterEach(() => {
  cleanup();
});

describe("ReclassifyPage", () => {
  // ── Case 1: loading → 3 dropdowns + AI panel after fetch ─────────────
  it("renders loading state, then platform + module + agent dropdowns + AI panel after fetches resolve", async () => {
    let resolveDetails!: (v: OperationDetails) => void;
    const detailsPromise = new Promise<OperationDetails>((res) => {
      resolveDetails = res;
    });
    let resolveSuggest!: (v: OperationSuggest) => void;
    const suggestPromise = new Promise<OperationSuggest>((res) => {
      resolveSuggest = res;
    });
    mockGetOperationDetails.mockReturnValueOnce(detailsPromise);
    mockGetOperationSuggest.mockReturnValueOnce(suggestPromise);

    render(<ReclassifyPage />);

    expect(screen.getByTestId("reclassify-page-loading")).toBeInTheDocument();

    resolveDetails(baseDetails);
    await screen.findByTestId("reclassify-module-select");
    expect(screen.getByTestId("reclassify-platform-select")).toBeInTheDocument();
    expect(screen.getByTestId("reclassify-agent-select")).toBeInTheDocument();
    // AI panel shows spinner while suggest still in flight.
    expect(screen.getByTestId("reclassify-ai-spinner")).toBeInTheDocument();

    resolveSuggest(happySuggest);
    await screen.findByTestId("reclassify-ai-content");
  });

  // ── Case 2: AI panel content + Use button when fallback === false ────
  it("AI panel shows content + Use suggestion button when fallback is false", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    expect(await screen.findByTestId("reclassify-ai-content")).toBeInTheDocument();
    expect(screen.getByTestId("reclassify-ai-use-button")).toBeInTheDocument();
    expect(screen.queryByTestId("reclassify-ai-fallback")).toBeNull();
  });

  // ── Case 3: AI panel fallback (no Use button) when fallback === true ─
  it("AI panel shows fallback message + NO Use button when fallback is true", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(fallbackSuggest);
    render(<ReclassifyPage />);
    expect(await screen.findByTestId("reclassify-ai-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("reclassify-ai-use-button")).toBeNull();
    expect(screen.queryByTestId("reclassify-ai-content")).toBeNull();
  });

  // ── Case 4: clicking Use suggestion fills module + agent; leaves platform untouched ──
  it("clicking Use suggestion updates module + agent dropdowns; platform unchanged", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    await screen.findByTestId("reclassify-ai-use-button");
    // Wait for the agent dropdown to be populated so the suggested
    // value renders as a real <option>.
    await screen.findByTestId("reclassify-agent-select");
    fireEvent.click(screen.getByTestId("reclassify-ai-use-button"));

    const moduleSelect = screen.getByTestId(
      "reclassify-module-select",
    ) as HTMLSelectElement;
    const agentSelect = screen.getByTestId(
      "reclassify-agent-select",
    ) as HTMLSelectElement;
    const platformSelect = screen.getByTestId(
      "reclassify-platform-select",
    ) as HTMLSelectElement;
    expect(moduleSelect.value).toBe("NDR");
    expect(agentSelect.value).toBe("ndr_resolver");
    // Phase-19 amendment — Use-suggestion path doesn't touch platform.
    expect(platformSelect.value).toBe("seller_panel");
  });

  // ── Case 5: Save with single-field platform change → PATCH body has only platform ──
  it("Save with platform change posts only platform; redirects to APIs tab on new platform", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    mockSetOperationClassification.mockResolvedValue({
      id: 281,
      module: baseDetails.module,
      agent: baseDetails.agent,
      persona: baseDetails.persona,
      module_curated: false,
      agent_curated: false,
      persona_curated: false,
      platform: "icrm_platform",
      platform_curated: true,
    });

    render(<ReclassifyPage />);
    const platformSelect = (await screen.findByTestId(
      "reclassify-platform-select",
    )) as HTMLSelectElement;
    fireEvent.change(platformSelect, { target: { value: "icrm_platform" } });

    fireEvent.click(screen.getByTestId("reclassify-save-button"));

    await waitFor(() => {
      expect(mockSetOperationClassification).toHaveBeenCalledWith(281, {
        platform: "icrm_platform",
      });
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/chat\/api-tools\?tab=apis&platform=icrm_platform&module=Order/,
        ),
      );
    });
  });

  // ── Case 6: Save disabled when no field differs and no Use clicked ────
  it("Save button disabled when no field differs and no Use suggestion", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    const saveBtn = (await screen.findByTestId(
      "reclassify-save-button",
    )) as HTMLButtonElement;
    expect(saveBtn).toBeDisabled();
  });

  // ── Case 7: Save failure → red banner with backend error text ─────────
  it("Save failure shows red banner with error text; no redirect", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    mockSetOperationClassification.mockRejectedValue(
      new Error("422 — invalid platform"),
    );

    render(<ReclassifyPage />);
    const platformSelect = (await screen.findByTestId(
      "reclassify-platform-select",
    )) as HTMLSelectElement;
    fireEvent.change(platformSelect, { target: { value: "icrm_platform" } });
    fireEvent.click(screen.getByTestId("reclassify-save-button"));

    expect(await screen.findByTestId("reclassify-save-error")).toHaveTextContent(
      /invalid platform/,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Case 8: Cancel → router.back, no API call ─────────────────────────
  it("Cancel calls router.back and does not POST", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    const cancelBtn = await screen.findByTestId("reclassify-cancel-button");
    fireEvent.click(cancelBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockSetOperationClassification).not.toHaveBeenCalled();
  });
});
