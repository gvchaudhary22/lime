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
  const [branch, setBranch] = useState<string>("");
  const disabled = !org || !repo || busy;

  async function handle() {
    if (!org || !repo) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = branch.trim();
      const r = await discoverPrs({
        org,
        repo,
        ...(trimmed ? { base_branch: trimmed } : {}),
      });
      onDiscovered?.(r.discovered_count, r.discovered_pr_ids);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "discover failed");
    } finally {
      setBusy(false);
    }
  }

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
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <GitPullRequestArrow className="h-3.5 w-3.5" />
        )}
        Sync new PRs
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
