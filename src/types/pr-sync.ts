// Phase 13 Wave 3A — types matching aiplatformkb /admin/pr-sync/* shapes.

export type SyncLifecycleStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface PrSyncDiscoverRequest {
  org: string;
  repo: string;
  base_branch?: string;   // Phase 17 — optional; server defaults to "master"
  domain?: string;
  limit_prs?: number;
}

export interface PrSyncDiscoverResponse {
  sync_run_id: number | null;
  discovered_count: number;
  discovered_pr_ids: number[];
  total_changed_files: number;
  est_total_classify_cost_usd: number;
}

export interface ClassifyPreview {
  pr_id: number;
  file_count: number;
  est_cost_usd: number;
  cached_hit: boolean;
}

export interface ClassifyResponse {
  pr_id: number;
  classify_status: SyncLifecycleStatus;
  cached_hit: boolean;
  impact_count: number;
  classify_cost_usd: number;
}

export interface PopulatePreview {
  pr_id: number;
  path_count: number;
  est_cost_usd: number;
}

export interface PopulateResponse {
  pr_id: number;
  populate_status: SyncLifecycleStatus;
  paths_populated: number;
  populate_cost_usd: number;
}

export interface PrSyncStatus {
  pr_id: number;
  pr_number: number;
  classify_status: SyncLifecycleStatus;
  classified_at: string | null;
  classify_cost_usd: number;
  populate_status: SyncLifecycleStatus;
  populate_at: string | null;
  populate_cost_usd: number;
}

export interface CancelResponse {
  pr_id: number;
  cancelled: ("classify" | "populate")[];
  was_already_terminated: boolean;
}
