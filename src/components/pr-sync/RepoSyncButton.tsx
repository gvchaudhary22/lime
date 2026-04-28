"use client";

// Phase 13 Wave 3B — header button on /chat/pr-feed.
// Triggers a cheap GitHub poll for new PRs in the currently-filtered repo.

import { GitPullRequestArrow, Loader2 } from "lucide-react";
import { useState } from "react";

import { discoverPrs } from "@/lib/aiplatformkb-api";

interface Props {
  org: string | null;
  repo: string | null;
  onDiscovered?: (count: number, prIds: number[]) => void;
}

export default function RepoSyncButton({ org, repo, onDiscovered }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !org || !repo || busy;

  async function handle() {
    if (!org || !repo) return;
    setBusy(true);
    setError(null);
    try {
      const r = await discoverPrs({ org, repo });
      onDiscovered?.(r.discovered_count, r.discovered_pr_ids);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "discover failed");
    } finally {
      setBusy(false);
    }
  }

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
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <GitPullRequestArrow className="h-3.5 w-3.5" />
        )}
        Sync new PRs
      </button>
      {error &&
        (error.startsWith("GitHub ")
          ? (() => {
              // Phase-22 (Wave-3B) — when discoverPrs / triggerClassify /
              // triggerPopulate surface a structured GitHub error, the
              // message arrives as `GitHub <status>: <msg> — <hint>`.
              // Split on the " — " separator so the hint wraps onto a
              // softer second row; pure presentation, no logic change.
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
