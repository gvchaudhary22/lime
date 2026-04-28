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

// Phase-22 (Wave-3A) — structured GitHub-error detail surfaced by the
// backend admin handlers when GitHub itself rejects the discover/classify/
// populate fetch. The client formats this as
// `GitHub <status>: <msg> — <hint>` for the 2-row error block.
//
// Phase-23 (Wave-3A) — promoted from a private alias inside
// aiplatformkb-api.ts so the new async DiscoverJobStatus.error_detail
// can refer to the same shape.
export interface GitHubErrorDetail {
  kind?: string;
  github_status?: number;
  github_message?: string;
  github_errors?: unknown[];
  url?: string;
  hint?: string;
}

// Phase-23 (Wave-3A) — async-job contract.
// `POST /admin/pr-sync/discover` now returns 202 with this shape; the
// frontend then polls /admin/pr-sync/discover/{sync_run_id}/status until
// status is "done" or "failed".
export interface DiscoverJobAccepted {
  sync_run_id: number;
  status: "running";
  scope: string;
}

// Phase-23 (Wave-3A) — full row shape returned by the status endpoint.
// Mirrors aiplatformkb pr_sync_runs row + Phase-22 error_detail.
export interface DiscoverJobStatus {
  sync_run_id: number;
  org: string;
  repo: string;
  status: "running" | "done" | "failed";
  started_at: string; // ISO 8601
  finished_at: string | null;
  error_message: string | null;
  error_detail: GitHubErrorDetail | null;
  discovered_count: number | null;
  discovered_pr_ids: number[] | null;
}

/**
 * @deprecated Phase-23 sync→async cut — `discoverPrs()` now returns
 * {@link DiscoverJobAccepted}. The synchronous PrSyncDiscoverResponse
 * shape is gone. Kept as a transitional alias for one PR cycle so any
 * stale internal import compiles; remove on the next pass.
 */
export type PrSyncDiscoverResponse = DiscoverJobAccepted;

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
