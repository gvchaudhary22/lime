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

async function getJson<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  // Note: no Authorization header. aiplatformkb is auth-less in v1.
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
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
  PatchToolPayload,
  PublicToolsResponse,
  RemoveApiFromToolResponse,
  ReorderModulesPayload,
  ReorderModulesResponse,
  ReorderOperationsPayload,
  ReorderOperationsResponse,
  ReorderToolApisPayload,
  ReorderToolApisResponse,
  SetEligibilityPayload,
  SetEligibilityResponse,
  ToolMember,
} from "@/types/api-tools";

async function jsonRequest<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
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
    const detail =
      (payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : null) || `Request failed: ${res.status}`;
    throw new AiplatformkbApiError(res.status, payload, detail);
  }
  return payload as T;
}

// ── Modules ──────────────────────────────────────────────────────────────

export function listAdminModules(): Promise<AdminModule[]> {
  return getJson<AdminModule[]>(`/admin/modules`);
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

// ── Aggregated namespace export ──────────────────────────────────────────

export const aiplatformkbApi = {
  // PR Feed (read-only — Phase 6).
  listPrs,
  getPrDetail,
  getFilterOptions,
  // Phase 12 admin.
  listAdminModules,
  reorderModules,
  listAdminOperations,
  reorderOperations,
  setOperationEligibility,
  getOperationCounts,
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
};

export type AiplatformkbApi = typeof aiplatformkbApi;
