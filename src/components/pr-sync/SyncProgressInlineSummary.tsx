"use client";

// Phase 13 Wave 3B — replaces the row's status cell while a classify or
// populate run is in flight, and after — shows accumulated cost.

import type { PrSyncStatus } from "@/types/pr-sync";

interface Props {
  status: PrSyncStatus | null;
}

export default function SyncProgressInlineSummary({ status }: Props) {
  if (!status) return null;
  const c = status.classify_status;
  const p = status.populate_status;

  if (c === "running") {
    return (
      <span className="text-xs text-sky-300" role="status">
        Classifying…
      </span>
    );
  }
  if (p === "running") {
    return (
      <span className="text-xs text-sky-300" role="status">
        Populating · ${status.populate_cost_usd.toFixed(2)}
      </span>
    );
  }
  if (c === "done" && p === "done") {
    const total = status.classify_cost_usd + status.populate_cost_usd;
    return (
      <span className="text-xs text-emerald-300">
        Done · ${total.toFixed(2)}
      </span>
    );
  }
  if (c === "failed" || p === "failed") {
    return <span className="text-xs text-rose-400">Failed</span>;
  }
  if (c === "cancelled" || p === "cancelled") {
    return <span className="text-xs text-amber-400">Cancelled</span>;
  }
  return null;
}
