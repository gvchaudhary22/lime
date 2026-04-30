"use client";

// Phase 28 follow-up — operator override for the populate-gate
// (scripts/kb/populate_gate.py). The default "Run kb_populate" button
// applies the gate: existing endpoints with only cosmetic risk_signals
// (scope_change, deprecation, performance_degradation) get skipped to
// avoid wasted Sonnet/Opus tokens. This button bypasses the gate so
// every impacted endpoint runs — needed when:
//   - populate code itself was improved (new model, prompt change)
//   - operator suspects classify mis-tagged a real spec change as cosmetic
//   - drift sweep across already-classified PRs

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerForcePopulate } from "@/lib/aiplatformkb-api";
import { usePopulateJobStatus } from "@/hooks/usePopulateJobStatus";
import type { GitHubErrorDetail, SyncLifecycleStatus } from "@/types/pr-sync";

interface Props {
  prId: number;
  classifyStatus: SyncLifecycleStatus | null;
  populateStatus: SyncLifecycleStatus | null;
  onCompleted?: () => void;
}

function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function ForcePopulateButton({
  prId,
  classifyStatus,
  populateStatus,
  onCompleted,
}: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { status: jobStatus } = usePopulateJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const showSpinner = submitting || isRunning;

  const disabled =
    showSpinner ||
    classifyStatus !== "done" ||
    populateStatus === "running";

  const tooltip =
    classifyStatus !== "done"
      ? "Classify impacts first"
      : populateStatus === "running"
        ? "Populate already running"
        : "Re-run populate, bypassing the populate-gate (regenerates specs even for existing endpoints with only cosmetic risk signals)";

  async function handle() {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await triggerForcePopulate(prId);
      setActiveJobId(r.sync_run_pr_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "force populate failed");
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
        setError(`populate ${jobStatus.status}`);
      }
      setActiveJobId(null);
    }
  }, [jobStatus, onCompleted]);

  const buttonLabel =
    isRunning && !submitting ? "Force populating…" : "Force populate";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={disabled}
        title={tooltip}
        className="inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500"
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
