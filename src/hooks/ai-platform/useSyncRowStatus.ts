// ai-platform replica of useSyncRowStatus — polls /kb/sync/lifecycle.

import { useEffect, useRef, useState } from "react";

import { getPrSyncStatus } from "@/lib/ai-platform-api";
import type { PrSyncStatus, SyncLifecycleStatus } from "@/types/pr-sync";

const TERMINAL: SyncLifecycleStatus[] = ["done", "failed", "cancelled"];

function bothTerminal(s: PrSyncStatus | null): boolean {
  if (!s) return false;
  return (
    TERMINAL.includes(s.classify_status) &&
    TERMINAL.includes(s.populate_status)
  );
}

export interface UseSyncRowStatus {
  status: PrSyncStatus | null;
  isPolling: boolean;
  error: string | null;
}

export function useSyncRowStatus(
  prId: number | null,
  intervalMs: number = 2000,
): UseSyncRowStatus {
  const [status, setStatus] = useState<PrSyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const aliveRef = useRef(true);

  async function fetchOnce() {
    if (prId == null) return;
    try {
      const s = await getPrSyncStatus(prId);
      if (!aliveRef.current) return;
      setStatus(s);
      setError(null);
      if (bothTerminal(s)) setIsPolling(false);
    } catch (e: unknown) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : "status fetch failed");
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    if (prId == null) {
      setStatus(null);
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    fetchOnce();
    const id = setInterval(() => {
      if (!aliveRef.current) return;
      fetchOnce();
    }, intervalMs);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prId, intervalMs]);

  return { status, isPolling, error };
}
