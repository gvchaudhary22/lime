"use client";

// Phase-25 (Wave-3B) — per-row "Sync impacts" cell, refactored as the
// async-job state machine that mirrors RepoSyncButton (Phase-23).
//
// Click → triggerClassify(prId) → 202 ({sync_run_pr_id, status, ...}).
//   - cached_hit short-circuit returns status="done" + impact_count
//     immediately; we fire onClassified() and skip polling entirely.
//   - Otherwise we set activeJobId and useClassifyJobStatus drives the
//     polling loop until terminal.
//
// On terminal "done" with impact_count > 0 the button hides (the row's
// Impacts column now drives the impact-count display per the v25 UX
// spec). On "failed"/"cancelled" we render the same Phase-22 2-row
// error block (`GitHub <status>: <msg> — <hint>`) that RepoSyncButton
// uses, sourced from jobStatus.error_detail.

import { Activity, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerClassify } from "@/lib/aiplatformkb-api";
import { useClassifyJobStatus } from "@/hooks/useClassifyJobStatus";
import type { GitHubErrorDetail } from "@/types/pr-sync";

interface Props {
  prId: number;
  onClassified?: (impactCount: number) => void;
}

// Mirror _formatGitHubErrorDetail in aiplatformkb-api.ts so the failed-job
// path produces the same `GitHub <status>: <msg> — <hint>` string the
// Phase-22 throw-path used. Single-source format keeps the 2-row error
// block JSX (below) compatible with both error sources.
function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function PerRowSyncImpactsButton({
  prId,
  onClassified,
}: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Snapshot the impact_count we observed at the terminal state so the
  // hide-on-done logic can stay decoupled from the polling hook (which
  // resets `status` to null on unmount and on prId change).
  const [terminalImpactCount, setTerminalImpactCount] = useState<
    number | null
  >(null);
  const { status: jobStatus } = useClassifyJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const showSpinner = submitting || isRunning;

  // Phase-25 UX — once classify lands with impact_count > 0 the per-row
  // Impacts column takes over, so the button hides. Zero-impact rows
  // keep the button visible so the curator can re-trigger.
  const hideAfterDone =
    terminalImpactCount !== null && terminalImpactCount > 0;

  async function handle() {
    if (showSpinner) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await triggerClassify(prId);
      // Phase-25 cached_hit short-circuit — backend already has a fresh
      // result (24h cache); skip the polling loop and fire the callback
      // straight away.
      if (r.status === "done") {
        setTerminalImpactCount(r.impact_count);
        onClassified?.(r.impact_count);
      } else {
        setActiveJobId(r.sync_run_pr_id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "classify failed");
    } finally {
      setSubmitting(false);
    }
  }

  // React to terminal job status from the polling hook. On "done", fire
  // onClassified, snapshot impact_count for hide-after-done, and clear
  // activeJobId so the button becomes clickable again. On "failed" /
  // "cancelled", synthesize the GitHub-prefixed error string when the
  // backend surfaced a structured detail; otherwise fall back to a
  // generic message.
  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "done") {
      setTerminalImpactCount(jobStatus.impact_count);
      onClassified?.(jobStatus.impact_count);
      setActiveJobId(null);
    } else if (
      jobStatus.status === "failed" ||
      jobStatus.status === "cancelled"
    ) {
      if (jobStatus.error_detail) {
        setError(_formatJobErrorDetail(jobStatus.error_detail));
      } else {
        setError(`classify ${jobStatus.status}`);
      }
      setActiveJobId(null);
    }
  }, [jobStatus, onClassified]);

  if (hideAfterDone) {
    return null;
  }

  const buttonLabel =
    isRunning && !submitting ? "Classifying…" : "Sync impacts";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handle}
        disabled={showSpinner}
        title="Run Sonnet impact classification on this PR"
        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showSpinner ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
      </button>
      {error &&
        (error.startsWith("GitHub ")
          ? (() => {
              // Phase-22 (Wave-3B) — the structured GitHub error arrives
              // as `GitHub <status>: <msg> — <hint>`. Split on " — " so
              // the hint wraps onto a softer second row; pure
              // presentation, no logic change. Mirrors RepoSyncButton's
              // IIFE pattern so the 2-row format lives in one place.
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
