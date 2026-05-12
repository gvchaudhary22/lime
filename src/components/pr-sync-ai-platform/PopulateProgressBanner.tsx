"use client";

// ai-platform replica of PopulateProgressBanner.

import { Loader2, X } from "lucide-react";
import { useState } from "react";

import { cancelPrSync } from "@/lib/ai-platform-api";
import type { PrSyncStatus } from "@/types/pr-sync";

interface Props {
  status: PrSyncStatus | null;
  onCancelled?: () => void;
}

export default function PopulateProgressBanner({ status, onCancelled }: Props) {
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  if (status.populate_status !== "running") return null;

  const targetPrId = status.pr_id;

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelPrSync(targetPrId);
      onCancelled?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/[0.06] px-6 py-2 text-sm text-emerald-200"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Populating · ~${status.populate_cost_usd.toFixed(2)} spent</span>
      </div>
      <button
        onClick={handleCancel}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        Cancel
      </button>
    </div>
  );
}
