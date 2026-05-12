"use client";

// ai-platform replica of RepoSyncButton. Triggers /kb/sync/discover/trigger
// and polls /kb/sync/discover/status via the new hook.

import { GitPullRequestArrow, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { discoverPrs } from "@/lib/ai-platform-api";
import { useDiscoverJobStatus } from "@/hooks/ai-platform/useDiscoverJobStatus";
import type { GitHubErrorDetail } from "@/types/pr-sync";

interface Props {
  org: string | null;
  repo: string | null;
  onDiscovered?: (count: number, prIds: number[]) => void;
}

function _formatJobErrorDetail(d: GitHubErrorDetail): string {
  const head = `GitHub ${d.github_status ?? "error"}: ${d.github_message ?? "(no message)"}`;
  const tail = d.hint ? ` — ${d.hint}` : "";
  return head + tail;
}

export default function RepoSyncButton({ org, repo, onDiscovered }: Props) {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { status: jobStatus } = useDiscoverJobStatus(activeJobId, 2000);

  const isRunning = activeJobId !== null;
  const disabled = !org || !repo || submitting || isRunning;

  async function handle() {
    if (!org || !repo) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await discoverPrs({ org, repo });
      setActiveJobId(r.sync_run_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "discover failed");
    } finally {
      setSubmitting(false);
    }
  }

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
