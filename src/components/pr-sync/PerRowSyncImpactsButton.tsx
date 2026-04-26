"use client";

// Phase 13 Wave 3B — per-row "Sync impacts" cell.
// Fetches /classify/preview to surface est cost; on confirm, fires
// /classify and starts polling via useSyncRowStatus.

import { Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  previewClassify,
  triggerClassify,
} from "@/lib/aiplatformkb-api";
import { useSyncRowStatus } from "@/hooks/useSyncRowStatus";
import type { ClassifyPreview } from "@/types/pr-sync";

interface Props {
  prId: number;
}

export default function PerRowSyncImpactsButton({ prId }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ClassifyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hook only polls once a trigger has fired (or status is already non-pending).
  const [polledPrId, setPolledPrId] = useState<number | null>(null);
  const { status } = useSyncRowStatus(polledPrId, 2000);

  const classifyStatus = status?.classify_status ?? null;
  const isRunning = classifyStatus === "running";
  const isDone = classifyStatus === "done";

  async function handlePreview() {
    setError(null);
    setBusy(true);
    try {
      const p = await previewClassify(prId);
      setPreview(p);
      if (p.cached_hit) {
        // Already done within 24h cache — short-circuit straight to polling
        // so the row reflects existing impact_count.
        setPolledPrId(prId);
        setPreview(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await triggerClassify(prId);
      setPreview(null);
      setPolledPrId(prId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "trigger failed");
    } finally {
      setBusy(false);
    }
  }

  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Classifying…
      </span>
    );
  }
  if (isDone && status) {
    return (
      <span className="text-xs text-emerald-300">
        Classified · {status.classify_cost_usd.toFixed(2)}$
      </span>
    );
  }

  if (preview) {
    return (
      <div className="inline-flex flex-col gap-1 text-xs">
        <span className="text-slate-300">
          {preview.file_count} files · ~${preview.est_cost_usd.toFixed(2)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="rounded bg-sky-500/20 px-2 py-0.5 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => setPreview(null)}
            disabled={busy}
            className="rounded bg-white/[0.05] px-2 py-0.5 text-slate-400 hover:bg-white/[0.08]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={handlePreview}
        disabled={busy}
        title="Run Sonnet impact classification on this PR"
        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.02] px-2 py-0.5 text-xs text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Sync impacts
      </button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  );
}
