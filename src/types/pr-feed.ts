// src/types/pr-feed.ts
// Mirror of aiplatformkb PR Feed API contract v1.1.
// Canonical source: aiplatformkb/docs/specs/pr-feed-api-contract.md
// Keep this file and app/models/pr_feed.py aligned; any change here needs
// a matching PR in aiplatformkb.

export type ProcessingStatus = "pending" | "processing" | "done" | "failed";

export type ImpactStatus =
  | "impacted"
  | "eligible_no_change"
  | "deprecated_skipped"
  | "new_pending";

export type ImpactType =
  | "direct_route"
  | "direct_controller"
  | "direct_indirect";

export type ApiStatus = "new" | "existing";

export type DeprecationState = "active" | "deprecated";

export interface ImpactCounts {
  impacted: number;
  eligible_no_change: number;
  deprecated_skipped: number;
  new_pending: number;
}

export interface PrListItem {
  id: number;
  sync_run_id: number;
  pr_number: number;
  pr_title: string | null;
  pr_url: string | null;
  pr_author: string | null;
  merged_at: string | null;
  merged_by: string | null;
  base_branch: string | null;
  changed_files: number;
  processing_status: ProcessingStatus;
  impact_counts: ImpactCounts;
}

export interface PrListResponse {
  total: number;
  limit: number;
  offset: number;
  items: PrListItem[];
}

export interface PrDetailHeader extends PrListItem {
  head_branch: string | null;
  approved_by: string[] | null;
  // Phase-25 (Wave-3D) — optional org/repo lifted from sync_runs so the
  // FE can construct the GitHub PR URL when pr_url is null (the HTTP-
  // path insert path in aiplatformkb does not always populate pr_url
  // on github_pr_log). Optional + nullable so older backends that
  // don't surface these fields keep compiling — the GitHub link just
  // omits gracefully when both are missing.
  org?: string | null;
  repo?: string | null;
}

export interface SyncRunSummary {
  id: number;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  routes_processed: number;
  routes_skipped: number;
  indirect_routes_processed: number;
  kb_files_written: number;
  db_rows_upserted: number;
}

export interface ImpactItem {
  id: number;
  http_path: string;
  http_method: string | null;
  platform: string | null;
  domain: string | null;
  api_status: ApiStatus;
  impact_status: ImpactStatus;
  impact_type: ImpactType;
  changed_source_file: string | null;
  indirect_file_path: string | null;
  llm_model: string | null;
  llm_confidence_score: number | null;
  llm_impact_description: string | null;
  llm_changed_functions: string[] | null;
  kb_file_path: string | null;
  kb_populated: number;
  // v1.1: derived from api_listing.elk_deprecated_api via LEFT JOIN on http_path.
  deprecation_state: DeprecationState | null;
}

export interface ImpactsPage {
  total: number;
  limit: number;
  offset: number;
  items: ImpactItem[];
}

export interface PrDetailResponse {
  pr: PrDetailHeader;
  sync_run: SyncRunSummary;
  impacts: ImpactsPage;
}

export interface FilterOptions {
  orgs: string[];
  repos: string[];
  authors: string[];
  base_branches: string[];
  domains: string[];
  platforms: string[];
}

// ── request-side filter shapes ────────────────────────────────────────────

export interface PrListFilters {
  org?: string;
  repo?: string;
  author?: string;
  base_branch?: string;
  processing_status?: ProcessingStatus;
  merged_after?: string;
  merged_before?: string;
  q?: string;
}

export interface PrDetailFilters {
  impact_status?: ImpactStatus[];
  api_status?: ApiStatus;
  // v1.1: new filter — direct_route | direct_controller | direct_indirect.
  impact_type?: ImpactType;
  // v1.1: new filter — derived via LEFT JOIN on api_listing.elk_deprecated_api.
  deprecation_state?: DeprecationState;
  platform?: string;
  domain?: string;
  http_method?: string;
  min_confidence?: number;
  q?: string;
}

export interface Pagination {
  limit?: number;
  offset?: number;
}
