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
  // Phase-20 — suggest now returns a 4th enum (platform). The mocked
  // listAdminPlatforms returns ["icrm_platform","seller_panel","srx"];
  // pick "icrm_platform" so it's a real switch from the row's current
  // "seller_panel" platform.
  platform: "icrm_platform",
  current: {
    module: "Order",
    agent: "shipment_ops",
    persona: "seller",
    platform: "seller_panel",
  },
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
  platform: null,
  current: {
    module: "Order",
    agent: "shipment_ops",
    persona: "seller",
    platform: "seller_panel",
  },
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

  // ── Case 4: clicking Use suggestion fills module + agent + platform ──
  it("clicking Use suggestion updates module + agent + platform dropdowns", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    await screen.findByTestId("reclassify-ai-use-button");
    // Wait for the agent dropdown to be populated so the suggested
    // value renders as a real <option>.
    await screen.findByTestId("reclassify-agent-select");
    // Wait for platforms list to load so the suggested platform is in
    // the allowed list when "Use suggestion" runs.
    await waitFor(() => {
      expect(mockListAdminPlatforms).toHaveBeenCalled();
    });
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
    // Phase-20 — Use-suggestion now ALSO fills platform when the
    // suggested value is in the allowed list.
    await waitFor(() => {
      expect(platformSelect.value).toBe("icrm_platform");
    });
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

  // ── Case 9 (Phase-20): AI panel renders Platform row when suggest returns platform ──
  it("AI panel renders Platform row with suggested value when suggest returns platform", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    await screen.findByTestId("reclassify-ai-content");
    const platformRow = screen.getByTestId("reclassify-ai-row-platform");
    expect(platformRow).toBeInTheDocument();
    expect(platformRow).toHaveTextContent("icrm_platform");
  });

  // ── Case 11 (Phase-21 Wave-1C): rapid platform-toggle A → B → A race ──
  // Curator toggles platform A → B → A in rapid succession. Three
  // concurrent listAdminAgents calls race; without an alive-guard the
  // final `agents` state could match B even though selected platform
  // is A. The AbortController sweep ensures only the LATEST fetch
  // resolves into setAgents.
  it("aborts in-flight agent fetch when platform changes rapidly (A → B → A)", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(fallbackSuggest);

    // Pre-toggle: mount fires listAdminAgents("seller_panel") → resolve
    // immediately so the page reaches steady state before the race.
    const seller_panel_agents = ["ndr_resolver", "shipment_ops"];
    const icrm_agents = ["icrm_agent_1", "icrm_agent_2"];
    const srx_agents = ["srx_agent_x", "srx_agent_y"];

    // Hold references to each call's resolver + AbortSignal so we can
    // simulate out-of-order resolution AND assert the abort signal was
    // wired through.
    const calls: Array<{
      platform: string;
      signal?: AbortSignal;
      resolve: (rows: string[]) => void;
    }> = [];

    mockListAdminAgents.mockImplementation(
      (platform: string, signal?: AbortSignal) => {
        // Mount call resolves immediately so the page reaches steady
        // state before the race begins.
        if (calls.length === 0 && platform === "seller_panel") {
          calls.push({ platform, signal, resolve: () => {} });
          return Promise.resolve(seller_panel_agents);
        }
        return new Promise<string[]>((res) => {
          calls.push({ platform, signal, resolve: res });
        });
      },
    );

    render(<ReclassifyPage />);
    const platformSelect = (await screen.findByTestId(
      "reclassify-platform-select",
    )) as HTMLSelectElement;
    // Wait for mount steady state.
    await waitFor(() => {
      expect(mockListAdminAgents).toHaveBeenCalled();
    });

    // Race: A (icrm) → B (srx) → A (icrm) again.
    fireEvent.change(platformSelect, { target: { value: "icrm_platform" } });
    fireEvent.change(platformSelect, { target: { value: "srx" } });
    fireEvent.change(platformSelect, { target: { value: "icrm_platform" } });

    // 4 calls: 1 mount + 3 toggle.
    await waitFor(() => {
      expect(mockListAdminAgents.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    // calls[1] = first icrm; calls[2] = srx; calls[3] = second icrm.
    const firstIcrm = calls[1];
    const srxCall = calls[2];
    const secondIcrm = calls[3];

    // Each toggle must have wired an AbortSignal.
    expect(firstIcrm.signal).toBeInstanceOf(AbortSignal);
    expect(srxCall.signal).toBeInstanceOf(AbortSignal);
    expect(secondIcrm.signal).toBeInstanceOf(AbortSignal);

    // The first two should be aborted by the time the third fires.
    expect(firstIcrm.signal!.aborted).toBe(true);
    expect(srxCall.signal!.aborted).toBe(true);
    expect(secondIcrm.signal!.aborted).toBe(false);

    // Resolve out of order: srx (B) resolves LAST, after the second
    // icrm (A) has resolved. Without the alive-guard, agents would end
    // up = srx_agents.
    secondIcrm.resolve(icrm_agents);
    // Yield microtask so React commits the state.
    await waitFor(() => {
      const agentSelect = screen.getByTestId(
        "reclassify-agent-select",
      ) as HTMLSelectElement;
      const opts = Array.from(agentSelect.options).map((o) => o.value);
      expect(opts).toEqual(expect.arrayContaining(icrm_agents));
    });

    // Now resolve the stale srx (B) fetch — it MUST NOT clobber the
    // current agents list with srx_agents.
    srxCall.resolve(srx_agents);
    firstIcrm.resolve(icrm_agents);

    // Give React a chance to (incorrectly) re-render if the alive-guard
    // is broken.
    await new Promise((r) => setTimeout(r, 10));

    const agentSelect = screen.getByTestId(
      "reclassify-agent-select",
    ) as HTMLSelectElement;
    const finalOpts = Array.from(agentSelect.options).map((o) => o.value);
    // Final list must be A's (icrm) agents, NOT B's (srx).
    expect(finalOpts).toEqual(expect.arrayContaining(icrm_agents));
    expect(finalOpts).not.toEqual(expect.arrayContaining(srx_agents));
  });

  // ── Case 12 (Phase-21 Wave-1C): Use-suggestion mid-platform-fetch ────
  // Curator fires a platform-onChange that triggers a slow agent fetch;
  // while pending, the Use-suggestion handler fires for a different
  // platform. The first (slow) fetch must be aborted so its late
  // resolution can't clobber the Use-suggestion's agent list.
  it("Use-suggestion mid-platform-fetch aborts the in-flight fetch", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);

    const calls: Array<{
      platform: string;
      signal?: AbortSignal;
      resolve: (rows: string[]) => void;
    }> = [];

    mockListAdminAgents.mockImplementation(
      (platform: string, signal?: AbortSignal) => {
        // Mount call resolves immediately so steady state is reached.
        if (calls.length === 0 && platform === "seller_panel") {
          calls.push({ platform, signal, resolve: () => {} });
          return Promise.resolve(["ndr_resolver", "shipment_ops"]);
        }
        return new Promise<string[]>((res) => {
          calls.push({ platform, signal, resolve: res });
        });
      },
    );

    render(<ReclassifyPage />);
    const platformSelect = (await screen.findByTestId(
      "reclassify-platform-select",
    )) as HTMLSelectElement;
    await screen.findByTestId("reclassify-ai-use-button");
    // Wait for platforms list to load so suggested platform is in the
    // allowed array when Use-suggestion runs.
    await waitFor(() => {
      expect(mockListAdminPlatforms).toHaveBeenCalled();
    });

    // Toggle platform → fires a pending agent fetch for "srx".
    fireEvent.change(platformSelect, { target: { value: "srx" } });
    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    const srxCall = calls[1];
    expect(srxCall.platform).toBe("srx");
    expect(srxCall.signal).toBeInstanceOf(AbortSignal);
    expect(srxCall.signal!.aborted).toBe(false);

    // Click Use-suggestion → suggested platform is "icrm_platform"
    // (per happySuggest). This must abort the srx fetch and fire a new
    // one for icrm_platform.
    fireEvent.click(screen.getByTestId("reclassify-ai-use-button"));

    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
    const icrmCall = calls[2];
    expect(icrmCall.platform).toBe("icrm_platform");
    expect(icrmCall.signal).toBeInstanceOf(AbortSignal);
    expect(icrmCall.signal!.aborted).toBe(false);

    // The srx fetch must now be aborted.
    expect(srxCall.signal!.aborted).toBe(true);

    // Resolve the icrm fetch first.
    const icrm_agents = ["ndr_resolver", "icrm_agent"];
    icrmCall.resolve(icrm_agents);

    await waitFor(() => {
      const agentSelect = screen.getByTestId(
        "reclassify-agent-select",
      ) as HTMLSelectElement;
      const opts = Array.from(agentSelect.options).map((o) => o.value);
      expect(opts).toEqual(expect.arrayContaining(icrm_agents));
    });

    // Now resolve the stale srx fetch — it MUST NOT clobber the
    // Use-suggestion's agent list.
    const srx_agents = ["srx_only_agent"];
    srxCall.resolve(srx_agents);

    // Give React a tick to (incorrectly) re-render if alive-guard is broken.
    await new Promise((r) => setTimeout(r, 10));

    const agentSelect = screen.getByTestId(
      "reclassify-agent-select",
    ) as HTMLSelectElement;
    const finalOpts = Array.from(agentSelect.options).map((o) => o.value);
    expect(finalOpts).toEqual(expect.arrayContaining(icrm_agents));
    expect(finalOpts).not.toContain("srx_only_agent");
  });

  // ── Case 10 (Phase-20): Use suggestion fills platform AND triggers agent re-fetch ──
  it("Use suggestion fills platformValue and re-fetches agents for the new platform", async () => {
    mockGetOperationDetails.mockResolvedValue(baseDetails);
    mockGetOperationSuggest.mockResolvedValue(happySuggest);
    render(<ReclassifyPage />);
    await screen.findByTestId("reclassify-ai-use-button");
    await screen.findByTestId("reclassify-agent-select");
    // Wait for platforms list to resolve so the suggested platform is
    // in the allowed array when Use suggestion runs.
    await waitFor(() => {
      expect(mockListAdminPlatforms).toHaveBeenCalled();
    });

    // Mount fired one listAdminAgents("seller_panel") call already.
    const callsBeforeUse = mockListAdminAgents.mock.calls.length;
    expect(callsBeforeUse).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByTestId("reclassify-ai-use-button"));

    // Use suggestion should fire a second listAdminAgents call scoped
    // to the suggested platform ("icrm_platform").
    await waitFor(() => {
      expect(mockListAdminAgents.mock.calls.length).toBeGreaterThan(
        callsBeforeUse,
      );
    });
    // Confirm the second call is platform-scoped to the suggested value.
    const lastCall =
      mockListAdminAgents.mock.calls[mockListAdminAgents.mock.calls.length - 1];
    expect(lastCall[0]).toBe("icrm_platform");

    const platformSelect = screen.getByTestId(
      "reclassify-platform-select",
    ) as HTMLSelectElement;
    await waitFor(() => {
      expect(platformSelect.value).toBe("icrm_platform");
    });
  });
});
