// src/lib/aiplatformkb-api.ts
// Read-only client for aiplatformkb's PR Feed API (/api/v1/prs*).
//
// Deliberately separate from src/lib/api.ts (MARS Go) — aiplatformkb is
// auth-less in v1, so no mars_token is ever attached. Mixing the two
// would risk leaking the Bearer to a different origin.
//
// Contract source: aiplatformkb/docs/specs/pr-feed-api-contract.md (v1.1).

import type {
  FilterOptions,
  Pagination,
  PrDetailFilters,
  PrDetailResponse,
  PrListFilters,
  PrListResponse,
} from "@/types/pr-feed";

const BASE_URL =
  process.env.NEXT_PUBLIC_AIPLATFORMKB_URL || "http://localhost:8000";

// Phase 13 Wave 1C — admin calls go through the Lime server-side proxy at
// /api/aiplatformkb/admin/[...path], which injects AIPLATFORMKB_ADMIN_TOKEN
// from server env. The token never reaches the browser. Public endpoints
// (/api/v1/prs*, /api/v1/ai-platform/*) stay direct against BASE_URL.
const ADMIN_PROXY_PREFIX = "/api/aiplatformkb";

function adminUrl(path: string): string {
  // path always starts with "/admin/..."; the proxy is mounted under
  // /api/aiplatformkb/admin/[...rest], so the final URL is
  // /api/aiplatformkb/admin/<rest>. Browser fetch resolves it against
  // the current origin (Lime). For SSR, NEXT_PUBLIC_LIME_URL would be
  // needed — but admin operations are all client-driven in v1.
  return `${ADMIN_PROXY_PREFIX}${path}`;
}

export class AiplatformkbApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "AiplatformkbApiError";
    this.status = status;
    this.body = body;
  }
}

function buildQuery(
  params: Record<string, string | number | string[] | undefined | null>
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== null && v !== "") usp.append(key, String(v));
      }
      continue;
    }
    usp.append(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function getJson<T>(
  path: string,
  options?: { signal?: AbortSignal },
): Promise<T> {
  // /admin/* routes through Lime server-side proxy (Phase 13 Wave 1C);
  // public endpoints stay direct against aiplatformkb.
  const url = path.startsWith("/admin/") ? adminUrl(path) : `${BASE_URL}${path}`;
  // Note: client never attaches Authorization. The proxy injects it for
  // /admin/* calls; public endpoints remain auth-less per Phase-6 contract.
  // Phase-21 (Wave-1C) — optional AbortSignal threaded into fetch so
  // call sites that race overlapping fetches (Reclassify page's
  // platform-onChange + Use-suggestion handlers) can cancel stale
  // in-flight requests instead of letting late resolutions clobber state.
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options?.signal,
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail =
      (body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : null) || `Request failed: ${res.status}`;
    throw new AiplatformkbApiError(res.status, body, detail);
  }
  return body as T;
}

export function listPrs(
  filters: PrListFilters = {},
  pagination: Pagination = {}
): Promise<PrListResponse> {
  const qs = buildQuery({
    org: filters.org,
    repo: filters.repo,
    author: filters.author,
    base_branch: filters.base_branch,
    processing_status: filters.processing_status,
    merged_after: filters.merged_after,
    merged_before: filters.merged_before,
    q: filters.q,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return getJson<PrListResponse>(`/api/v1/prs${qs}`);
}

export function getPrDetail(
  prId: number | string,
  filters: PrDetailFilters = {},
  pagination: Pagination = {}
): Promise<PrDetailResponse> {
  const qs = buildQuery({
    impact_status: filters.impact_status,
    api_status: filters.api_status,
    impact_type: filters.impact_type,
    deprecation_state: filters.deprecation_state,
    platform: filters.platform,
    domain: filters.domain,
    http_method: filters.http_method,
    min_confidence: filters.min_confidence,
    q: filters.q,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return getJson<PrDetailResponse>(`/api/v1/prs/${prId}${qs}`);
}

export function getFilterOptions(): Promise<FilterOptions> {
  return getJson<FilterOptions>(`/api/v1/prs/filters/options`);
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 12 — curation admin (BFRS-2/aiplatformkb#<NNN>) + public tools.json.
// Same auth-less convention as PR Feed: NO Authorization header is ever
// attached. The deployment boundary (firewall around aiplatformkb :9000)
// is the gate; see PHASE-12-PLAN.md §2.5.
// ─────────────────────────────────────────────────────────────────────────

import type {
  AddApiToToolPayload,
  AddApiToToolResponse,
  AdminModule,
  AdminOperation,
  AdminTool,
  CreateToolPayload,
  ListOperationsParams,
  OperationCountsResponse,
  OperationDetails,
  OperationSuggest,
  PatchToolPayload,
  PublicToolsResponse,
  RemoveApiFromToolResponse,
  ReorderModulesPayload,
  ReorderModulesResponse,
  ReorderOperationsPayload,
  ReorderOperationsResponse,
  ReorderToolApisPayload,
  ReorderToolApisResponse,
  SetClassificationPayload,
  SetClassificationResponse,
  SetEligibilityPayload,
  SetEligibilityResponse,
  ToolMember,
} from "@/types/api-tools";

// Phase-22 (Wave-3A) — admin/pr-sync/discover (and classify/populate, which
// shell out to the same GitHub-fetch path) now return a structured 4xx/502
// detail when GitHub itself fails. Shape:
//   { detail: { kind: "http"|"network"|"decode",
//               github_status: number, github_message: string,
//               github_errors?: [...], url?: string, hint?: string } }
// We surface that as a single human-readable Error.message so the FE
// component can render it (RepoSyncButton splits on " — " for a 2-row
// layout). Non-structured detail (existing FastAPI string detail) falls
// back to the legacy stringification so unrelated admin errors keep
// their current message.
//
// Phase-23 (Wave-3A) — the GitHubErrorDetail shape moved into
// `@/types/pr-sync` so DiscoverJobStatus.error_detail can refer to it.
// The local alias is kept here for backward compatibility with the
// existing _formatGitHubErrorDetail call site.
import type { GitHubErrorDetail } from "@/types/pr-sync";

function _formatGitHubErrorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const detailRaw = (payload as { detail?: unknown }).detail;
  if (!detailRaw || typeof detailRaw !== "object") return null;
  const d = detailRaw as GitHubErrorDetail;
  if (!d.kind || !d.github_message) return null;
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

async function jsonRequest<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  // /admin/* routes through Lime server-side proxy (Phase 13 Wave 1C);
  // public endpoints stay direct.
  const url = path.startsWith("/admin/") ? adminUrl(path) : `${BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { Accept: "application/json" },
  };
  if (body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    // Phase-22 (Wave-3A) — prefer the structured GitHub-error detail when
    // present so callers like RepoSyncButton get an actionable message
    // instead of "[object Object]" / generic status text.
    const githubMsg = _formatGitHubErrorDetail(payload);
    if (githubMsg) {
      throw new AiplatformkbApiError(res.status, payload, githubMsg);
    }
    const detail =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : null) || `Request failed: ${res.status}`;
    throw new AiplatformkbApiError(res.status, payload, detail);
  }
  return payload as T;
}

// ── Modules ──────────────────────────────────────────────────────────────

export function listAdminModules(platform?: string): Promise<AdminModule[]> {
  // Phase-17 — when `platform` is provided, the backend returns
  // distinct modules from api_listing scoped to that platform (LEFT
  // JOIN module_descriptions for display metadata). Omit it for the
  // global, platform-agnostic view (current ModulesTab behaviour).
  const qs = buildQuery({ platform });
  return getJson<AdminModule[]>(`/admin/modules${qs}`);
}

// Phase-19 amendment — distinct platforms currently in api_listing.
// Drives the Reclassify-page Platform dropdown; ground truth lives in
// the rows themselves (no hardcoded enum to drift against).
export function listAdminPlatforms(): Promise<string[]> {
  return getJson<string[]>("/admin/platforms");
}

// Phase-19 amendment — distinct agents in api_listing. Optional
// `platform` query param scopes the list to one platform (mirrors
// listAdminModules's contract). The Reclassify-page Agent dropdown
// re-fetches with the current platform so options track the row.
//
// Phase-21 (Wave-1C) — accepts an optional AbortSignal so the
// Reclassify page can cancel a stale in-flight fetch when the curator
// rapidly toggles platforms (or fires Use-suggestion mid-fetch);
// only the LATEST resolution wins.
export function listAdminAgents(
  platform?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return getJson<string[]>(`/admin/agents${qs}`, { signal });
}

export function reorderModules(
  payload: ReorderModulesPayload
): Promise<ReorderModulesResponse> {
  return jsonRequest<ReorderModulesResponse>(
    "POST",
    `/admin/modules/reorder`,
    payload
  );
}

// ── Operations ───────────────────────────────────────────────────────────

export function listAdminOperations(
  params: ListOperationsParams
): Promise<AdminOperation[]> {
  const qs = buildQuery({ platform: params.platform, module: params.module });
  return getJson<AdminOperation[]>(`/admin/operations${qs}`);
}

export function reorderOperations(
  payload: ReorderOperationsPayload
): Promise<ReorderOperationsResponse> {
  return jsonRequest<ReorderOperationsResponse>(
    "POST",
    `/admin/operations/reorder`,
    payload
  );
}

export function setOperationEligibility(
  operationId: number,
  payload: SetEligibilityPayload
): Promise<SetEligibilityResponse> {
  return jsonRequest<SetEligibilityResponse>(
    "PATCH",
    `/admin/operations/${operationId}/eligibility`,
    payload
  );
}

export function getOperationCounts(
  platform: string
): Promise<OperationCountsResponse> {
  const qs = buildQuery({ platform });
  return getJson<OperationCountsResponse>(`/admin/operations/counts${qs}`);
}

// Phase 16 — read-only deep-read for the "See details" drawer.
// Fetches one api_listing row + LEFT-JOINed elk_api_hits breakdown.
// Routes through the server-side admin proxy (bearer token injected
// server-side; never reaches the browser).
export function getOperationDetails(
  operationId: number
): Promise<OperationDetails> {
  return getJson<OperationDetails>(`/admin/operations/${operationId}/details`);
}

// Phase 19 — curator override. PATCH-style body — only the fields the
// curator changed get sent. Backend flips the matching <col>_curated
// lock flags so populate_kb won't re-classify them.
export function setOperationClassification(
  id: number,
  body: SetClassificationPayload,
): Promise<SetClassificationResponse> {
  return jsonRequest<SetClassificationResponse>(
    "POST",
    `/admin/operations/${id}/classification`,
    body,
  );
}

// Phase 19 — real-time LLM advisor. Single Haiku 4.5 call (cached
// in-memory for 60s). Returns `{fallback: true}` with HTTP 200 when
// the gateway is unreachable or the API key is unset.
export function getOperationSuggest(id: number): Promise<OperationSuggest> {
  return getJson<OperationSuggest>(`/admin/operations/${id}/suggest`);
}

// ── Tools CRUD ───────────────────────────────────────────────────────────

export function listTools(): Promise<AdminTool[]> {
  return getJson<AdminTool[]>(`/admin/tools`);
}

export function createTool(payload: CreateToolPayload): Promise<AdminTool> {
  return jsonRequest<AdminTool>("POST", `/admin/tools`, payload);
}

export function patchTool(
  toolId: number,
  payload: PatchToolPayload
): Promise<{ updated: number }> {
  return jsonRequest<{ updated: number }>("PATCH", `/admin/tools/${toolId}`, payload);
}

export function archiveTool(toolId: number): Promise<{ archived: number }> {
  return jsonRequest<{ archived: number }>("DELETE", `/admin/tools/${toolId}`);
}

export function getToolApis(toolId: number): Promise<ToolMember[]> {
  return getJson<ToolMember[]>(`/admin/tools/${toolId}/apis`);
}

// ── Tool↔API M:N membership ──────────────────────────────────────────────

export function addApiToTool(
  toolId: number,
  payload: AddApiToToolPayload
): Promise<AddApiToToolResponse> {
  return jsonRequest<AddApiToToolResponse>(
    "POST",
    `/admin/tools/${toolId}/apis`,
    payload
  );
}

export function removeApiFromTool(
  toolId: number,
  apiId: number
): Promise<RemoveApiFromToolResponse> {
  return jsonRequest<RemoveApiFromToolResponse>(
    "DELETE",
    `/admin/tools/${toolId}/apis/${apiId}`
  );
}

export function reorderToolApis(
  toolId: number,
  payload: ReorderToolApisPayload
): Promise<ReorderToolApisResponse> {
  return jsonRequest<ReorderToolApisResponse>(
    "POST",
    `/admin/tools/${toolId}/reorder`,
    payload
  );
}

// ── Public tools.json (used by the AI agent — read-only) ─────────────────

export function listToolsPublic(): Promise<PublicToolsResponse> {
  return getJson<PublicToolsResponse>(`/api/v1/ai-platform/tools.json`);
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 13 — granular per-PR sync surface (BFRS-2/aiplatformkb#<NNN>).
// All admin-gated; routed through the same /api/aiplatformkb proxy as
// /admin/* — token injection is the proxy's job, not this client's.
// ─────────────────────────────────────────────────────────────────────────

import type {
  CancelResponse,
  ClassifyJobAccepted,
  ClassifyJobStatus,
  ClassifyPreview,
  DiscoverJobAccepted,
  DiscoverJobStatus,
  PopulateJobAccepted,
  PopulateJobStatus,
  PopulatePreview,
  PrSyncDiscoverRequest,
  PrSyncStatus,
} from "@/types/pr-sync";

// Phase-22 (Wave-3A) — wrap the shared jsonRequest so the failure surface
// renders an op-specific fallback ("discover failed (500)") for legacy /
// non-structured errors while preserving the GitHub-prefixed message that
// _formatGitHubErrorDetail emits for the new structured 4xx/502 detail.
// classify + populate get the same wrapper since their backend handlers
// shell out to the same GitHub-fetch path and surface identical errors.
async function _runWithOpLabel<T>(
  op: "discover" | "classify" | "populate",
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AiplatformkbApiError) {
      // _formatGitHubErrorDetail-flavoured messages start with "GitHub ".
      // Non-structured fallback messages get the op-specific label so the
      // RepoSyncButton (and other call sites) read "discover failed (500)".
      if (err.message.startsWith("GitHub ")) throw err;
      throw new Error(`${op} failed (${err.status})`);
    }
    throw err;
  }
}

// Phase-23 (Wave-3A) — discover is now async. The POST returns 202 with
// DiscoverJobAccepted ({sync_run_id, status:"running", scope}); the caller
// kicks the polling hook with the returned sync_run_id and waits for the
// status endpoint to flip to "done"/"failed". The Phase-22
// _runWithOpLabel wrapper still applies — 202 is success so the parser
// doesn't fire, and 4xx (config error / scope-locked 409) still flows
// through the same GitHub-error / op-label fallback.
export function discoverPrs(
  payload: PrSyncDiscoverRequest
): Promise<DiscoverJobAccepted> {
  return _runWithOpLabel("discover", () =>
    jsonRequest<DiscoverJobAccepted>(
      "POST",
      `/admin/pr-sync/discover`,
      payload
    )
  );
}

// Phase-23 (Wave-3A) — poll the async discover job status.
export function getDiscoverJobStatus(
  syncRunId: number,
): Promise<DiscoverJobStatus> {
  return getJson<DiscoverJobStatus>(
    `/admin/pr-sync/discover/${syncRunId}/status`,
  );
}

export function previewClassify(prId: number): Promise<ClassifyPreview> {
  return getJson<ClassifyPreview>(
    `/admin/pr-sync/prs/${prId}/classify/preview`
  );
}

// Phase-25 (Wave-3A) — classify is now async. The POST returns 202 with
// ClassifyJobAccepted ({sync_run_pr_id, status:"running"|"done",
// cached_hit, impact_count}). When status === "done" the backend
// short-circuited via the 24h cache — the caller can skip polling and
// fire onClassified() immediately. Otherwise drive the polling loop via
// useClassifyJobStatus until /classify/status flips to a terminal state.
export function triggerClassify(prId: number): Promise<ClassifyJobAccepted> {
  return _runWithOpLabel("classify", () =>
    jsonRequest<ClassifyJobAccepted>(
      "POST",
      `/admin/pr-sync/prs/${prId}/classify`
    )
  );
}

// Force-reclassify — bypasses the 24h cache + DELETEs prior api_impact_log
// rows in a single transaction. Use when curators have shipped a classify
// fix and want to refresh an already-classified PR (Phase 28 v2 cutover,
// post-fix recovery, etc.).
export function triggerForceClassify(
  prId: number,
): Promise<ClassifyJobAccepted> {
  return _runWithOpLabel("classify", () =>
    jsonRequest<ClassifyJobAccepted>(
      "POST",
      `/admin/pr-sync/prs/${prId}/classify?force=true`,
    ),
  );
}

// Phase-25 (Wave-3A) — poll the async classify job status.
export function getClassifyJobStatus(
  prId: number,
): Promise<ClassifyJobStatus> {
  return getJson<ClassifyJobStatus>(
    `/admin/pr-sync/prs/${prId}/classify/status`,
  );
}

export function previewPopulate(prId: number): Promise<PopulatePreview> {
  return getJson<PopulatePreview>(
    `/admin/pr-sync/prs/${prId}/populate/preview`
  );
}

// Phase-25 (Wave-3A) — populate is now async. The POST returns 202 with
// PopulateJobAccepted ({sync_run_pr_id, status:"running"}); the FE
// drives the polling loop via usePopulateJobStatus until /populate/status
// flips to a terminal state. The endpoint also returns 400 if the PR
// hasn't been classified yet — _runWithOpLabel surfaces that as
// "populate failed (400)".
export function triggerPopulate(prId: number): Promise<PopulateJobAccepted> {
  return _runWithOpLabel("populate", () =>
    jsonRequest<PopulateJobAccepted>(
      "POST",
      `/admin/pr-sync/prs/${prId}/populate`
    )
  );
}

// Phase-25 (Wave-3A) — poll the async populate job status.
export function getPopulateJobStatus(
  prId: number,
): Promise<PopulateJobStatus> {
  return getJson<PopulateJobStatus>(
    `/admin/pr-sync/prs/${prId}/populate/status`,
  );
}

export function getPrSyncStatus(prId: number): Promise<PrSyncStatus> {
  return getJson<PrSyncStatus>(`/admin/pr-sync/prs/${prId}`);
}

export function cancelPrSync(prId: number): Promise<CancelResponse> {
  return jsonRequest<CancelResponse>(
    "POST",
    `/admin/pr-sync/prs/${prId}/cancel`
  );
}

// ── Aggregated namespace export ──────────────────────────────────────────

export const aiplatformkbApi = {
  // PR Feed (read-only — Phase 6).
  listPrs,
  getPrDetail,
  getFilterOptions,
  // Phase 12 admin.
  listAdminModules,
  // Phase 19 amendment — dynamic platform/agent dropdowns.
  listAdminPlatforms,
  listAdminAgents,
  reorderModules,
  listAdminOperations,
  reorderOperations,
  setOperationEligibility,
  getOperationCounts,
  // Phase 16 — operation details drawer.
  getOperationDetails,
  // Phase 19 — curator override + AI suggestion.
  setOperationClassification,
  getOperationSuggest,
  listTools,
  createTool,
  patchTool,
  archiveTool,
  getToolApis,
  addApiToTool,
  removeApiFromTool,
  reorderToolApis,
  // Phase 12 public.
  listToolsPublic,
  // Phase 13 sync.
  discoverPrs,
  // Phase 23 — async discover job status polling.
  getDiscoverJobStatus,
  previewClassify,
  triggerClassify,
  triggerForceClassify,
  // Phase-25 — async classify job status polling.
  getClassifyJobStatus,
  previewPopulate,
  triggerPopulate,
  // Phase-25 — async populate job status polling.
  getPopulateJobStatus,
  getPrSyncStatus,
  cancelPrSync,
};

export type AiplatformkbApi = typeof aiplatformkbApi;
