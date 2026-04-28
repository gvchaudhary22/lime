"use client";

// Phase-25 (Wave-3C) — header button on /chat/pr-feed/[prId], refactored
// as the async-job state machine that mirrors RepoSyncButton (Phase-23)
// and PerRowSyncImpactsButton (Phase-25). Disabled until classify
// reaches "done"; once populate completes the button hides (the
// pipeline is finished — re-running has no curator value).
//
// Click → triggerPopulate(prId) → 202 ({sync_run_pr_id, status:"running"})
//   → setActiveJobId → usePopulateJobStatus drives the polling loop
//   until terminal. The detail page also mounts PopulateProgressBanner
//   to show running state at the top of the viewport; this component
//   owns the start trigger + post-trigger spinner / error surface.

import { Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerPopulate } from "@/lib/aiplatformkb-api";
import { usePopulateJobStatus } from "@/hooks/usePopulateJobStatus";
import type { GitHubErrorDetail, SyncLifecycleStatus } from "@/types/pr-sync";

interface Props {
  prId: number;
  classifyStatus: SyncLifecycleStatus | null;
  populateStatus: SyncLifecycleStatus | null;
  onTriggered?: () => void;
}

// Mirror _formatGitHubErrorDetail in aiplatformkb-api.ts so the failed-
// job path produces the same `GitHub <status>: <msg> — <hint>` string
// the Phase-22 throw-path used. Single-source format keeps the 2-row
// error block JSX (below) compatible with both error sources.
function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function RunPopulateButton({
  prId,
  classifyStatus,
  populateStatus,
  onTriggered,
}: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Snapshot the terminal state once seen so the post-done hide stays
  // decoupled from the polling hook (which resets `status` to null on
  // unmount and on prId change).
  const [terminalDone, setTerminalDone] = useState(false);
  const { status: jobStatus } = usePopulateJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const showSpinner = submitting || isRunning;

  // Disabled gate — classify must be done, populate must not already be
  // running (server-side state from the parent's useSyncRowStatus poll
  // also flips populate_status to "running" once the job is accepted).
  const disabled =
    showSpinner ||
    classifyStatus !== "done" ||
    populateStatus === "running";

  const tooltip =
    classifyStatus !== "done"
      ? "Classify impacts first"
      : populateStatus === "running"
        ? "Populate already running"
        : "Run populate_kb on impacted routes";

  async function handle() {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await triggerPopulate(prId);
      setActiveJobId(r.sync_run_pr_id);
      onTriggered?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "populate failed");
    } finally {
      setSubmitting(false);
    }
  }

  // React to terminal job status from the polling hook. On "done", flip
  // `terminalDone` so the button hides — the pipeline is complete and
  // re-running has no curator value. On "failed"/"cancelled", surface
  // the structured GitHub-error detail (or fall back to a generic
  // message) and clear activeJobId so the curator can retry.
  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "done") {
      setTerminalDone(true);
      setActiveJobId(null);
    } else if (
      jobStatus.status === "failed" ||
      jobStatus.status === "cancelled"
    ) {
      if (jobStatus.error_detail) {
        setError(_formatJobErrorDetail(jobStatus.error_detail));
      } else {
        setError(`populate ${jobStatus.status}`);
      }
      setActiveJobId(null);
    }
  }, [jobStatus]);

  // Phase-25 — populate done means pipeline is finished; hide the
  // button. Source of truth is either the polled jobStatus terminal we
  // captured or the parent's populateStatus prop (handles the page-load
  // case where the PR was already populated before this component
  // mounted).
  if (terminalDone || populateStatus === "done") {
    return null;
  }

  const buttonLabel =
    isRunning && !submitting ? "Populating…" : "Run kb_populate";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={disabled}
        title={tooltip}
        className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500"
      >
        {showSpinner ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
      </button>
      {error &&
        (error.startsWith("GitHub ")
          ? (() => {
              // Phase-22 (Wave-3B) — the structured GitHub error arrives
              // as `GitHub <status>: <msg> — <hint>`. Split on " — " so
              // the hint wraps onto a softer second row; pure
              // presentation, no logic change. Mirrors the IIFE pattern
              // used by RepoSyncButton + PerRowSyncImpactsButton so the
              // 2-row format lives in one place.
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
