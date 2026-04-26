// src/types/api-tools.ts
// Shapes for the Phase-12 curation admin (BFRS-2/aiplatformkb#<NNN>).
// All endpoints under /admin/* are auth-less (mirrors PR Feed).

export type ToolStatus = "active" | "draft" | "archived";

// ── Modules ──────────────────────────────────────────────────────────────

export interface AdminModule {
  module_name: string;
  display_name: string | null;
  display_order: number | null;
}

export interface ReorderModulesPayload {
  ordered_modules: string[];
}

export interface ReorderModulesResponse {
  updated: number;
}

// ── Operations ───────────────────────────────────────────────────────────

export interface AdminOperation {
  id: number;
  http_method: string;
  path: string;
  display_order: number | null;
  tool_name: string | null;
  hit_count_7d: number | null;
  // Phase-12 — gated visibility on /docs/ai-platform.
  ai_platform_eligible_api: boolean;
  read_write_type: string | null;
  risk_level: string | null;
  // Phase-12 — deprecation flags drive the "Show deprecated" filter
  // in the APIs tab. Treat either-true as "deprecated" for display.
  deprecated: boolean;
  elk_deprecated_api: boolean;
}

export interface ModuleCounts {
  total: number;
  active: number;
  deprecated: number;
}

export interface OperationCountsResponse {
  platform: string;
  total: number;
  active: number;
  deprecated: number;
  by_module: Record<string, ModuleCounts>;
}

export interface SetEligibilityPayload {
  eligible: boolean;
}

export interface SetEligibilityResponse {
  id: number;
  ai_platform_eligible_api: boolean;
}

export interface ListOperationsParams {
  platform: string;
  module: string;
}

export interface ReorderOperationsPayload {
  platform: string;
  module: string;
  ordered_ids: number[];
}

export interface ReorderOperationsResponse {
  platform: string;
  module: string;
  curated: number;
}

// ── Tools (CRUD) ─────────────────────────────────────────────────────────

export interface AdminTool {
  id: number;
  name: string;
  description: string | null;
  display_order: number | null;
  status: ToolStatus;
}

export interface CreateToolPayload {
  name: string;
  description?: string | null;
  status?: ToolStatus;
}

export interface PatchToolPayload {
  name?: string;
  description?: string | null;
  status?: ToolStatus;
  display_order?: number | null;
}

export interface ToolMember {
  api_listing_id: number;
  http_method: string;
  path: string;
  tool_name: string | null;
  position: number;
}

// ── Tool↔API M:N membership ──────────────────────────────────────────────

export interface AddApiToToolPayload {
  api_id: number;
}

export interface AddApiToToolResponse {
  tool_id: number;
  api_listing_id: number;
  added: number;       // 1 if newly added, 0 if already a member (idempotent)
  position: number | null;
}

export interface RemoveApiFromToolResponse {
  tool_id: number;
  api_listing_id: number;
  removed: number;     // 1 if deleted, 0 if not a member (idempotent)
}

export interface ReorderToolApisPayload {
  ordered_api_ids: number[];
}

export interface ReorderToolApisResponse {
  tool_id: number;
  reordered: number;
}

// ── Public tools.json (consumed by the AI agent) ─────────────────────────

export interface PublicToolApi {
  id: number;
  method: string;
  path: string;
  tool_name: string | null;
  position: number;
}

export interface PublicTool {
  id: number;
  name: string;
  description: string | null;
  display_order: number | null;
  status: ToolStatus;
  apis: PublicToolApi[];
}

export interface PublicToolsResponse {
  version: string;
  tools: PublicTool[];
}
