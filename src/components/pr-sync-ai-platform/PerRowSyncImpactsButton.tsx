"use client";

// ai-platform replica of PerRowSyncImpactsButton.

import { Activity, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerClassify } from "@/lib/ai-platform-api";
import { useClassifyJobStatus } from "@/hooks/ai-platform/useClassifyJobStatus";
import type { GitHubErrorDetail } from "@/types/pr-sync";

interface Props {
  prId: number;
  onClassified?: (impactCount: number) => void;
  serverImpactCount?: number;
}

function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function PerRowSyncImpactsButton({
  prId,
  onClassified,
  serverImpactCount,
}: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [terminalImpactCount, setTerminalImpactCount] = useState<
    number | null
  >(null);
  const { status: jobStatus } = useClassifyJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const showSpinner = submitting || isRunning;

  const hideAfterDone =
    (terminalImpactCount !== null && terminalImpactCount > 0) ||
    (serverImpactCount !== undefined && serverImpactCount > 0);

  async function handle() {
    if (showSpinner) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await triggerClassify(prId);
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

  if (hideAfterDone) return null;

  const buttonLabel = isRunning && !submitting ? "Classifying…" : "Sync impacts";

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
