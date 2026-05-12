// src/lib/ai-platform-api.ts
//
// Browser client for the ai-platform service's KB admin HTTP surface
// (`POST /kb/*`). Companion to src/lib/aiplatformkb-api.ts, which talks to
// the *different* aiplatformkb service. Routes here mirror the
// ai-platform `/kb/*` endpoints introduced in its Phase 17.
//
// Calls go direct browser → http://localhost:8000 (configurable via
// NEXT_PUBLIC_AI_PLATFORM_URL). The ai-platform service must list this
// origin in its CORS allowlist; default config now includes
// http://localhost:3000.

const BASE_URL =
  process.env.NEXT_PUBLIC_AI_PLATFORM_URL || "http://localhost:8000";

const DEFAULT_ORG = "shiprocket";

// ── Error class ────────────────────────────────────────────────────────

export class AiPlatformApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "AiPlatformApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Envelope ───────────────────────────────────────────────────────────
// ai-platform wraps every response in {success, status_code, data} on
// 2xx and {success:false, status_code, message, error} on 4xx/5xx.

interface SuccessEnvelope<T> {
  success: true;
  status_code: number;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  status_code: number;
  message: string;
  error?: Record<string, unknown>;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ org: DEFAULT_ORG, ...body }),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as ErrorEnvelope).message)
        : null) || `Request failed: ${res.status}`;
    throw new AiPlatformApiError(res.status, payload, msg);
  }

  const env = payload as SuccessEnvelope<T> | null;
  if (!env || env.success !== true) {
    throw new AiPlatformApiError(res.status, payload, "Malformed response envelope");
  }
  return env.data;
}

// ── Types (match ai-platform `_operation_payload` etc.) ────────────────

export interface AiPlatformModule {
  module_name: string;
  display_name: string | null;
  display_order: number | null;
  owner: string | null;
}

export interface AiPlatformOperation {
  api_id: string;
  org: string;
  platform: string;
  module: string;
  sub_module: string | null;
  http_method: string;
  path: string;
  display_order: number | null;
  ai_platform_eligible_api: boolean;
  agent: string | null;
  persona: string | null;
  module_curated: boolean;
  agent_curated: boolean;
  persona_curated: boolean;
  platform_curated: boolean;
  risk_level: string | null;
  read_write_type: string | null;
  hit_count_7d: number | null;
}

export interface AiPlatformOperationCounts {
  total: number;
  eligible: number;
  module_curated: number;
  agent_curated: number;
  persona_curated: number;
  platform_curated: number;
}

export interface AiPlatformElkDetails {
  host: string | null;
  index: string | null;
  hit_count_7d: number | null;
  hit_count_updated_at: string | null;
  deprecated_api: boolean;
}

export interface AiPlatformOperationDetails {
  operation: AiPlatformOperation;
  description: string | null;
  controller: string | null;
  source_file: string | null;
  repo_name: string | null;
  base_url: string | null;
  api_version: string | null;
  auth: string | null;
  auth_scope: string | null;
  auth_type: string | null;
  approval_mode: string | null;
  rate_limit_rpm: number | null;
  intent: string | null;
  tool_name: string | null;
  seller_menu_key: string | null;
  ui_section: string | null;
  ui_subsection: string | null;
  page_url: string | null;
  reject_description: string | null;
  elk: AiPlatformElkDetails;
}

// ── Endpoint wrappers ──────────────────────────────────────────────────

export function listModules(platform?: string): Promise<AiPlatformModule[]> {
  return postJson<{ modules: AiPlatformModule[] }>("/kb/modules/list", {
    platform: platform || null,
  }).then((d) => d.modules);
}

export function reorderModules(payload: {
  ordered_module_names: string[];
}): Promise<number> {
  return postJson<{ updated: number }>("/kb/modules/reorder", {
    ordered_module_names: payload.ordered_module_names,
  }).then((d) => d.updated);
}

export function setModuleOwner(
  moduleName: string,
  payload: { owner: string | null },
): Promise<AiPlatformModule> {
  return postJson<{ module: AiPlatformModule }>("/kb/modules/set-owner", {
    module_name: moduleName,
    owner: payload.owner,
  }).then((d) => d.module);
}

export function listPlatforms(): Promise<string[]> {
  return postJson<{ platforms: string[] }>("/kb/platforms/list", {}).then(
    (d) => d.platforms,
  );
}

export function listOperations(params: {
  platform: string;
  module?: string;
}): Promise<AiPlatformOperation[]> {
  return postJson<{ operations: AiPlatformOperation[] }>("/kb/operations/list", {
    platform: params.platform,
    module: params.module || null,
  }).then((d) => d.operations);
}

export function reorderOperations(payload: {
  ordered_api_ids: string[];
}): Promise<number> {
  return postJson<{ updated: number }>("/kb/operations/reorder", {
    ordered_api_ids: payload.ordered_api_ids,
  }).then((d) => d.updated);
}

export function setOperationEligibility(payload: {
  api_id: string;
  eligible: boolean;
}): Promise<AiPlatformOperation> {
  return postJson<{ operation: AiPlatformOperation }>(
    "/kb/operations/set-eligibility",
    { api_id: payload.api_id, eligible: payload.eligible },
  ).then((d) => d.operation);
}

export function getOperationCounts(
  platform: string,
): Promise<AiPlatformOperationCounts> {
  return postJson<{ counts: AiPlatformOperationCounts }>(
    "/kb/operations/counts",
    { platform },
  ).then((d) => d.counts);
}

export function getOperationDetails(
  api_id: string,
): Promise<AiPlatformOperationDetails> {
  return postJson<{ details: AiPlatformOperationDetails }>(
    "/kb/operations/details",
    { api_id },
  ).then((d) => d.details);
}

// ──────────────────────────────────────────────────────────────────────
// PR feed + sync surface (ai-platform `POST /kb/prs/*` + `/kb/sync/*`).
// We reuse lime's existing pr-feed + pr-sync types where shapes match,
// adapting field names on the wire where they differ (e.g. ai-platform
// returns `pr_id` on classify/populate status; the lime types expect
// `sync_run_pr_id`). Mapping happens inside each wrapper so callers
// never see the wire shape.
// ──────────────────────────────────────────────────────────────────────

import type {
  FilterOptions,
  Pagination,
  PrDetailFilters,
  PrDetailResponse,
  PrListFilters,
  PrListResponse,
} from "@/types/pr-feed";
import type {
  CancelResponse,
  ClassifyJobAccepted,
  ClassifyJobStatus,
  DiscoverJobAccepted,
  DiscoverJobStatus,
  PopulateJobAccepted,
  PopulateJobStatus,
  PrSyncDiscoverRequest,
  PrSyncStatus,
} from "@/types/pr-sync";

function _emptyToNull(s: string | undefined | null): string | null {
  return s ? s : null;
}

// PR list — ai-platform body: {filters: {repo_name, author, base_branch,
// processing_status, merged_after, merged_before, q}, limit, offset}.
// `org` is injected by postJson. lime's PrListFilters.repo maps to
// ai-platform's repo_name.
export function listPrs(
  filters: PrListFilters = {},
  pagination: Pagination = {},
): Promise<PrListResponse> {
  return postJson<PrListResponse>("/kb/prs/list", {
    filters: {
      repo_name: _emptyToNull(filters.repo),
      author: _emptyToNull(filters.author),
      base_branch: _emptyToNull(filters.base_branch),
      processing_status: _emptyToNull(filters.processing_status),
      merged_after: filters.merged_after ?? null,
      merged_before: filters.merged_before ?? null,
      q: _emptyToNull(filters.q),
    },
    limit: pagination.limit ?? 50,
    offset: pagination.offset ?? 0,
  });
}

// PR detail. lime's PrDetailFilters has impact_status: ImpactStatus[]
// (multi-select) but ai-platform takes a single string — we join with
// comma if multiple are passed and let the backend treat the first as
// the active filter (best-effort; multi-select is rare on the detail
// page). The replica primarily drives single-select via the URL anyway.
export function getPrDetail(
  prId: number,
  filters: PrDetailFilters = {},
  pagination: Pagination = {},
): Promise<PrDetailResponse> {
  return postJson<PrDetailResponse>("/kb/prs/detail", {
    pr_id: prId,
    impact_filters: {
      impact_status: filters.impact_status?.[0] ?? null,
      impact_type: _emptyToNull(filters.impact_type),
      platform: _emptyToNull(filters.platform),
      http_method: _emptyToNull(filters.http_method),
      q: _emptyToNull(filters.q),
    },
    limit: pagination.limit ?? 50,
    offset: pagination.offset ?? 0,
  });
}

export function getFilterOptions(): Promise<FilterOptions> {
  return postJson<{ options: FilterOptions }>("/kb/prs/filter-options", {})
    .then((d) => d.options);
}

// Discover — ai-platform body: {repo, merged_after?, merged_before?,
// limit, request_token?}. lime's PrSyncDiscoverRequest includes
// `domain` + `base_branch` + `limit_prs` which ai-platform doesn't
// support (base_branch is resolved server-side from kb_repositories);
// limit_prs maps to `limit` and the rest are dropped.
export function discoverPrs(
  payload: PrSyncDiscoverRequest,
): Promise<DiscoverJobAccepted> {
  return postJson<{ sync_run_id: number; status: string; scope: string }>(
    "/kb/sync/discover/trigger",
    {
      repo: payload.repo,
      ...(payload.limit_prs ? { limit: payload.limit_prs } : {}),
    },
  ).then((d) => ({
    sync_run_id: d.sync_run_id,
    status: "running" as const,
    scope: d.scope,
  }));
}

export function getDiscoverJobStatus(
  syncRunId: number,
): Promise<DiscoverJobStatus> {
  return postJson<DiscoverJobStatus>("/kb/sync/discover/status", {
    sync_run_id: syncRunId,
  });
}

// Classify trigger. ai-platform returns {pr_id, status, cached_hit,
// impact_count, estimated_cost_usd}; lime expects sync_run_pr_id —
// we map pr_id → sync_run_pr_id (the ai-platform contract uses pr_id
// as the row handle).
export function triggerClassify(prId: number): Promise<ClassifyJobAccepted> {
  return postJson<{
    pr_id: number;
    status: "running" | "done";
    cached_hit: boolean;
    impact_count: number;
  }>("/kb/sync/classify/trigger", { pr_id: prId, force: false }).then((d) => ({
    sync_run_pr_id: d.pr_id,
    status: d.status,
    cached_hit: d.cached_hit,
    impact_count: d.impact_count,
  }));
}

export function triggerForceClassify(
  prId: number,
): Promise<ClassifyJobAccepted> {
  return postJson<{
    pr_id: number;
    status: "running" | "done";
    cached_hit: boolean;
    impact_count: number;
  }>("/kb/sync/classify/trigger", { pr_id: prId, force: true }).then((d) => ({
    sync_run_pr_id: d.pr_id,
    status: d.status,
    cached_hit: d.cached_hit,
    impact_count: d.impact_count,
  }));
}

export function getClassifyJobStatus(
  prId: number,
): Promise<ClassifyJobStatus> {
  return postJson<{
    pr_id: number;
    status: ClassifyJobStatus["status"];
    classified_at: string | null;
    classify_cost_usd: number;
    impact_count: number;
    error_detail: ClassifyJobStatus["error_detail"];
  }>("/kb/sync/classify/status", { pr_id: prId }).then((d) => ({
    sync_run_pr_id: d.pr_id,
    status: d.status,
    classified_at: d.classified_at,
    classify_cost_usd: d.classify_cost_usd,
    impact_count: d.impact_count,
    error_detail: d.error_detail,
  }));
}

export function triggerPopulate(prId: number): Promise<PopulateJobAccepted> {
  return postJson<{ pr_id: number; status: "running" }>(
    "/kb/sync/populate/trigger",
    { pr_id: prId, force: false },
  ).then((d) => ({ sync_run_pr_id: d.pr_id, status: "running" as const }));
}

export function triggerForcePopulate(
  prId: number,
): Promise<PopulateJobAccepted> {
  return postJson<{ pr_id: number; status: "running" }>(
    "/kb/sync/populate/trigger",
    { pr_id: prId, force: true },
  ).then((d) => ({ sync_run_pr_id: d.pr_id, status: "running" as const }));
}

export function getPopulateJobStatus(
  prId: number,
): Promise<PopulateJobStatus> {
  return postJson<{
    pr_id: number;
    status: PopulateJobStatus["status"];
    populate_at: string | null;
    populate_cost_usd: number;
    error_detail: PopulateJobStatus["error_detail"];
  }>("/kb/sync/populate/status", { pr_id: prId }).then((d) => ({
    sync_run_pr_id: d.pr_id,
    status: d.status,
    populate_at: d.populate_at,
    populate_cost_usd: d.populate_cost_usd,
    error_detail: d.error_detail,
  }));
}

// ai-platform's lifecycle endpoint returns {pr_id, classify_status,
// classified_at, classify_cost_usd, populate_status, populate_at,
// populate_cost_usd}. lime's PrSyncStatus type also requires pr_number,
// which ai-platform doesn't surface — we fill it with 0 as a sentinel.
// (Consumer UIs only use pr_number for the header link; the detail
// page already has it from PrListItem.)
export function getPrSyncStatus(prId: number): Promise<PrSyncStatus> {
  return postJson<{
    pr_id: number;
    classify_status: PrSyncStatus["classify_status"];
    classified_at: string | null;
    classify_cost_usd: number;
    populate_status: PrSyncStatus["populate_status"];
    populate_at: string | null;
    populate_cost_usd: number;
  }>("/kb/sync/lifecycle", { pr_id: prId }).then((d) => ({
    pr_id: d.pr_id,
    pr_number: 0,
    classify_status: d.classify_status,
    classified_at: d.classified_at,
    classify_cost_usd: d.classify_cost_usd,
    populate_status: d.populate_status,
    populate_at: d.populate_at,
    populate_cost_usd: d.populate_cost_usd,
  }));
}

export function cancelPrSync(prId: number): Promise<CancelResponse> {
  return postJson<CancelResponse>("/kb/sync/cancel", { pr_id: prId });
}
