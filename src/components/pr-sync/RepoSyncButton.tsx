"use client";

// Phase 13 Wave 3B — header button on /chat/pr-feed.
// Triggers a cheap GitHub poll for new PRs in the currently-filtered repo.
//
// Phase-23 (Wave-3C) — discover is now async. The POST returns 202 with
// {sync_run_id}; we drive a polling state machine via
// useDiscoverJobStatus and only fire onDiscovered() when the job
// status flips to "done". On "failed" we synthesize the same
// `GitHub <status>: <msg> — <hint>` message the Phase-22 path uses, so
// the existing 2-row error block JSX is reused unchanged.

import { GitPullRequestArrow, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { discoverPrs } from "@/lib/aiplatformkb-api";
import { useDiscoverJobStatus } from "@/hooks/useDiscoverJobStatus";
import type { GitHubErrorDetail } from "@/types/pr-sync";

interface Props {
  org: string | null;
  repo: string | null;
  onDiscovered?: (count: number, prIds: number[]) => void;
}

// Mirror _formatGitHubErrorDetail in aiplatformkb-api.ts so the failed-job
// path produces the same `GitHub <status>: <msg> — <hint>` string the
// Phase-22 throw-path used. Keeps the 2-row error block JSX a
// single-source format.
function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function RepoSyncButton({ org, repo, onDiscovered }: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const { status: jobStatus } = useDiscoverJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const disabled = !org || !repo || submitting || isRunning;

  async function handle() {
    if (!org || !repo) return;
    setSubmitting(true);
    setError(null);
    try {
      // Phase 17 — branch input threads through as `base_branch?`.
      // Empty / whitespace-only input omits the field so the backend
      // defaults to master. Phase 23 — POST returns 202 with a job
      // handle; polling drives the terminal state.
      const trimmed = branch.trim();
      const r = await discoverPrs({
        org,
        repo,
        ...(trimmed ? { base_branch: trimmed } : {}),
      });
      // Polling kicks in via the effect below.
      setActiveJobId(r.sync_run_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "discover failed");
    } finally {
      setSubmitting(false);
    }
  }

  // React to terminal job status from the polling hook. On "done", fire
  // onDiscovered with the row counts and clear activeJobId so the button
  // becomes clickable again. On "failed", synthesize the same
  // GitHub-prefixed error string the Phase-22 throw-path used so the
  // existing 2-row error block JSX renders unchanged.
  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "done") {
      onDiscovered?.(
        jobStatus.discovered_count ?? 0,
        jobStatus.discovered_pr_ids ?? [],
      );
      setActiveJobId(null);
    } else if (jobStatus.status === "failed") {
      if (jobStatus.error_detail) {
        setError(_formatJobErrorDetail(jobStatus.error_detail));
      } else {
        setError(jobStatus.error_message ?? "discover failed");
      }
      setActiveJobId(null);
    }
  }, [jobStatus, onDiscovered]);

  const showSpinner = submitting || isRunning;
  const buttonLabel = isRunning && !submitting ? "Discovering…" : "Sync new PRs";

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="master"
        disabled={disabled}
        maxLength={128}
        list="repo-sync-branch-suggestions"
        aria-label="Base branch (default: master)"
        title="Base branch to discover PRs against — leave blank to use master"
        className="w-32 rounded border border-white/[0.06] bg-[#0a0f1e] px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      {/* Suggestions for the two canonical default branches. Operators can
          still type any value (free-text input); datalist just makes the
          common case a one-click pick. Mirrors the backend hardening that
          always includes master + main in /api/v1/prs/filters/options. */}
      <datalist id="repo-sync-branch-suggestions">
        <option value="master" />
        <option value="main" />
      </datalist>
      <button
        onClick={handle}
        disabled={disabled}
        title={
          !org || !repo
            ? "Select an org and repo first"
            : "Poll GitHub for newly merged PRs"
        }
        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showSpinner ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <GitPullRequestArrow className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
      </button>
      {error &&
        (error.startsWith("GitHub ")
          ? (() => {
              // Phase-22 (Wave-3B) — when discoverPrs / triggerClassify /
              // triggerPopulate surface a structured GitHub error, the
              // message arrives as `GitHub <status>: <msg> — <hint>`.
              // Split on the " — " separator so the hint wraps onto a
              // softer second row; pure presentation, no logic change.
              //
              // Phase-23 (Wave-3C) — the source of `error` shifted from
              // a thrown Error to the polled jobStatus.error_detail, but
              // the formatter is identical, so this JSX is reused
              // unchanged.
              const sepIdx = error.indexOf(" — ");
              const head = sepIdx >= 0 ? error.slice(0, sepIdx) : error;
              const hint = sepIdx >= 0 ? error.slice(sepIdx + 3) : "";
              return (
                <div className="flex max-w-md flex-col gap-0.5 text-xs">
                  <span className="text-rose-400">{head}</span>
                  {hint && <span className="text-slate-400">{hint}</span>}
                </div>
              );
            })()
          : (
              <span className="text-xs text-rose-400">{error}</span>
            ))}
    </div>
  );
}
