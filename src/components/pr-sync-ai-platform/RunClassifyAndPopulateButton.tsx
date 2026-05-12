"use client";

// ai-platform replica of RunClassifyAndPopulateButton.

import { Loader2, PlayCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { triggerClassify, triggerPopulate } from "@/lib/ai-platform-api";
import { useClassifyJobStatus } from "@/hooks/ai-platform/useClassifyJobStatus";
import { usePopulateJobStatus } from "@/hooks/ai-platform/usePopulateJobStatus";
import type { GitHubErrorDetail, SyncLifecycleStatus } from "@/types/pr-sync";

type Stage = "idle" | "classifying" | "populating" | "done";

interface Props {
  prId: number;
  classifyStatus?: SyncLifecycleStatus | null;
  populateStatus?: SyncLifecycleStatus | null;
  alreadyDone?: boolean;
  onCompleted?: () => void;
  variant?: "row" | "header";
}

function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function RunClassifyAndPopulateButton({
  prId,
  classifyStatus,
  populateStatus,
  alreadyDone,
  onCompleted,
  variant = "row",
}: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [classifyJobId, setClassifyJobId] = useState<number | null>(null);
  const [populateJobId, setPopulateJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const populateKickedOff = useRef(false);

  const { status: classifyJob } = useClassifyJobStatus(classifyJobId, 2000);
  const { status: populateJob } = usePopulateJobStatus(populateJobId, 2000);

  const isWorking = stage === "classifying" || stage === "populating";
  const showSpinner = submitting || isWorking;

  async function startPopulate() {
    if (populateKickedOff.current) return;
    populateKickedOff.current = true;
    try {
      const r = await triggerPopulate(prId);
      setPopulateJobId(r.sync_run_pr_id);
      setStage("populating");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "populate trigger failed");
      setStage("idle");
    }
  }

  async function handle() {
    if (showSpinner) return;
    setSubmitting(true);
    setError(null);
    populateKickedOff.current = false;
    try {
      if (classifyStatus === "done") {
        setStage("populating");
        await startPopulate();
        return;
      }
      const r = await triggerClassify(prId);
      if (r.status === "done") {
        setStage("populating");
        await startPopulate();
      } else {
        setClassifyJobId(r.sync_run_pr_id);
        setStage("classifying");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "classify trigger failed");
      setStage("idle");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!classifyJob) return;
    if (classifyJob.status === "done") {
      setClassifyJobId(null);
      void startPopulate();
    } else if (
      classifyJob.status === "failed" ||
      classifyJob.status === "cancelled"
    ) {
      if (classifyJob.error_detail) {
        setError(_formatJobErrorDetail(classifyJob.error_detail));
      } else {
        setError(`classify ${classifyJob.status}`);
      }
      setClassifyJobId(null);
      setStage("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classifyJob]);

  useEffect(() => {
    if (!populateJob) return;
    if (populateJob.status === "done") {
      setPopulateJobId(null);
      setStage("done");
      onCompleted?.();
    } else if (
      populateJob.status === "failed" ||
      populateJob.status === "cancelled"
    ) {
      if (populateJob.error_detail) {
        setError(_formatJobErrorDetail(populateJob.error_detail));
      } else {
        setError(`populate ${populateJob.status}`);
      }
      setPopulateJobId(null);
      setStage("idle");
    }
  }, [populateJob, onCompleted]);

  if (alreadyDone || populateStatus === "done" || stage === "done") {
    return null;
  }

  const disabled = showSpinner || populateStatus === "running";

  const label = (() => {
    if (stage === "classifying") return "Classifying…";
    if (stage === "populating") return "Populating…";
    if (variant === "row") return "Sync + Populate";
    return "Run classify + populate";
  })();

  const tooltip =
    populateStatus === "running"
      ? "Populate already running"
      : "Run classify, then populate, in one click";

  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={disabled}
        title={tooltip}
        className={buttonClass}
      >
        {showSpinner ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PlayCircle className="h-3.5 w-3.5" />
        )}
        {label}
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
