"use client";

// ai-platform replica of RunPopulateButton.

import { Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { triggerPopulate } from "@/lib/ai-platform-api";
import { usePopulateJobStatus } from "@/hooks/ai-platform/usePopulateJobStatus";
import type { GitHubErrorDetail, SyncLifecycleStatus } from "@/types/pr-sync";

interface Props {
  prId: number;
  classifyStatus: SyncLifecycleStatus | null;
  populateStatus: SyncLifecycleStatus | null;
  onTriggered?: () => void;
}

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
  const [terminalDone, setTerminalDone] = useState(false);
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

  if (terminalDone || populateStatus === "done") return null;

  const buttonLabel = isRunning && !submitting ? "Populating…" : "Run kb_populate";

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
