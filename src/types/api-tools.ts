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

// ── Operation details drawer ────────────────────────────────────────────
// Mirrors the backend response of GET /admin/operations/{id}/details.
// Read-only deep-read for the lime "See details" drawer in ApisTab. ELK
// fields come from the denormalized api_listing columns; the per-day,
// per-index, and status breakdowns are not surfaced (operators consult
// Kibana directly when that level of detail is needed).

export interface ElkDetails {
  elk_host: string | null;
  elk_index: string | null;
  hit_count_7d: number | null;
  hit_count_updated_at: string | null;        // ISO 8601 from backend
  elk_deprecated_api: boolean;
}

export interface OperationDetails {
  // Identity
  id: number;
  api_id: string;
  repo_name: string | null;
  base_url: string | null;
  // Routing
  http_method: string;
  path: string;
  api_version: string | null;
  auth_type: string | null;
  auth_scope: string | null;
  rate_limit_rpm: number | null;
  // Classification
  platform: string;
  module: string;
  sub_module: string | null;
  agent: string | null;
  persona: string | null;
  intent: string | null;
  seller_menu_key: string | null;
  ui_section: string | null;
  ui_subsection: string | null;
  page_url: string | null;
  // Code provenance
  controller: string | null;
  source_file: string | null;
  tool_name: string | null;
  description: string | null;
  // Risk + curation
  approval_mode: string | null;
  risk_level: string | null;
  read_write_type: string | null;
  deprecated: boolean;
  elk_deprecated_api: boolean;
  ai_platform_eligible_api: boolean;
  // Phase-19 — manual-override lock flags. true = curator pinned this
  // field; populate_kb's UPSERT will preserve it on future syncs.
  module_curated: boolean;
  agent_curated: boolean;
  persona_curated: boolean;
  // Phase-19 amendment — platform is also curator-overridable now.
  platform_curated: boolean;
  display_order: number | null;
  reject_description: string | null;
  // ELK summary (from api_listing denormalized columns)
  elk: ElkDetails;
  // Metadata
  created_at: string | null;
  updated_at: string | null;
}

// ── Reclassify (Phase 19) ──────────────────────────────────────────────

export interface SetClassificationPayload {
  module?: string;
  agent?: string;
  persona?: string;
  // Phase-19 amendment — when set, backend flips platform_curated = 1
  // and the populate_kb UPSERT will preserve this value going forward.
  // Validated server-side against /^[a-z][a-z0-9_]{0,63}$/.
  platform?: string;
}

export interface SetClassificationResponse {
  id: number;
  module: string;
  agent: string | null;
  persona: string | null;
  module_curated: boolean;
  agent_curated: boolean;
  persona_curated: boolean;
  platform: string;
  // Phase-19 amendment — surfaced in the response so the UI can refresh
  // the lock badge after Save.
  platform_curated: boolean;
}

export interface OperationSuggestCurrent {
  module: string;
  agent: string | null;
  persona: string | null;
  // Phase-20 — the row's current platform value, mirrored in the suggest
  // payload so the UI can show "current → suggested" deltas.
  platform: string | null;
}

export interface OperationSuggest {
  module: string | null;
  agent: string | null;
  persona: string | null;
  // Phase-20 — LLM's platform pick (or null on out-of-enum drop). The
  // backend validates against the platforms table allowlist.
  platform: string | null;
  current: OperationSuggestCurrent;
  reasoning: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  fallback: boolean;
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
