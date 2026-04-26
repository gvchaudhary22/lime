"use client";

// Phase 13 Wave 3C — header button on /chat/pr-feed/[prId].
// Disabled until classify_status='done'. Two-step UX: previewPopulate →
// confirm with cost → triggerPopulate.

import { Loader2, Play } from "lucide-react";
import { useState } from "react";

import {
  previewPopulate,
  triggerPopulate,
} from "@/lib/aiplatformkb-api";
import type { PopulatePreview, SyncLifecycleStatus } from "@/types/pr-sync";

interface Props {
  prId: number;
  classifyStatus: SyncLifecycleStatus | null;
  populateStatus: SyncLifecycleStatus | null;
  onTriggered?: () => void;
}

export default function RunPopulateButton({
  prId,
  classifyStatus,
  populateStatus,
  onTriggered,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PopulatePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    busy ||
    classifyStatus !== "done" ||
    populateStatus === "running";

  const tooltip =
    classifyStatus !== "done"
      ? "Classify impacts first"
      : populateStatus === "running"
        ? "Populate already running"
        : "Run populate_kb on impacted routes";

  async function handlePreview() {
    setError(null);
    setBusy(true);
    try {
      setPreview(await previewPopulate(prId));
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
      await triggerPopulate(prId);
      setPreview(null);
      onTriggered?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "trigger failed");
    } finally {
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <div className="inline-flex flex-col gap-1 text-xs">
        <span className="text-slate-300">
          {preview.path_count} routes · ~${preview.est_cost_usd.toFixed(2)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="rounded bg-emerald-500/20 px-3 py-1 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => setPreview(null)}
            disabled={busy}
            className="rounded bg-white/[0.05] px-3 py-1 text-slate-400 hover:bg-white/[0.08]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePreview}
        disabled={disabled}
        title={tooltip}
        className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Run kb_populate
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
