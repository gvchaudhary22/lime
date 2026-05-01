"use client";

// Phase 28 follow-up — header button on /chat/pr-feed/[prId] that
// force-reclassifies the PR. Bypasses the 24h cache + DELETEs prior
// api_impact_log rows in a single transaction. Curator escape hatch
// when the classify pipeline has been improved (e.g. Phase 28
// route_block scoping fix) and the PR needs to be re-run against the
// new code path.
//
// Click → triggerForceClassify(prId) → 202 + status="running"
//   → setActiveJobId → useClassifyJobStatus drives the polling loop
//   until terminal. On "done", calls onCompleted so the parent page
//   can refetch the impact rows. On failure, shows the error inline.

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerForceClassify } from "@/lib/aiplatformkb-api";
import { useClassifyJobStatus } from "@/hooks/useClassifyJobStatus";
import type { GitHubErrorDetail, SyncLifecycleStatus } from "@/types/pr-sync";

interface Props {
  prId: number;
  classifyStatus: SyncLifecycleStatus | null;
  onCompleted?: () => void;
}

function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function ForceClassifyButton({
  prId,
  classifyStatus,
  onCompleted,
}: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { status: jobStatus } = useClassifyJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const showSpinner = submitting || isRunning;

  // Disabled while a classify is already running. We allow click when
  // status is "done" (the whole point — re-run after a fix) or when
  // there's no prior classify yet.
  const disabled = showSpinner || classifyStatus === "running";

  const tooltip =
    classifyStatus === "running"
      ? "Classify already running"
      : "Re-run classify, bypassing the 24h cache (deletes prior impact_log rows for this PR)";

  async function handle() {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await triggerForceClassify(prId);
      if (r.status === "running") {
        setActiveJobId(r.sync_run_pr_id);
      } else if (r.status === "done") {
        // Cache hit (rare on force=true; surfaced as a no-op completion).
        onCompleted?.();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "classify failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "done") {
      setActiveJobId(null);
      onCompleted?.();
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
  }, [jobStatus, onCompleted]);

  const buttonLabel =
    isRunning && !submitting ? "Reclassifying…" : "Force reclassify";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={disabled}
        title={tooltip}
        className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500"
      >
        {showSpinner ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
      </button>
      {error &&
        (error.startsWith("GitHub ")
          ? (() => {
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
          : <span className="text-xs text-rose-400">{error}</span>)}
    </div>
  );
}
