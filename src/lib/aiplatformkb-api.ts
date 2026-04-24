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

export const aiplatformkbApi = {
  listPrs,
  getPrDetail,
  getFilterOptions,
};

export type AiplatformkbApi = typeof aiplatformkbApi;
