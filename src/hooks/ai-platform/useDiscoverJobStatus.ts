// ai-platform replica of useDiscoverJobStatus — same polling shape,
// new client. Polls /kb/sync/discover/status every `intervalMs` until
// status is terminal ("done" / "failed").

"use client";

import { useEffect, useRef, useState } from "react";

import { getDiscoverJobStatus } from "@/lib/ai-platform-api";
import type { DiscoverJobStatus } from "@/types/pr-sync";

const TERMINAL = new Set<DiscoverJobStatus["status"]>(["done", "failed"]);

export interface UseDiscoverJobStatus {
  status: DiscoverJobStatus | null;
  isPolling: boolean;
  error: string | null;
}

export function useDiscoverJobStatus(
  syncRunId: number | null,
  intervalMs: number = 2000,
): UseDiscoverJobStatus {
  const [status, setStatus] = useState<DiscoverJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const aliveRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    if (syncRunId == null) {
      setStatus(null);
      setError(null);
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    setStatus(null);
    setError(null);

    let cancelled = false;

    async function tick() {
      if (cancelled || !aliveRef.current) return;
      try {
        const s = await getDiscoverJobStatus(syncRunId!);
        if (cancelled || !aliveRef.current) return;
        setStatus(s);
        setError(null);
        if (TERMINAL.has(s.status)) {
          setIsPolling(false);
          return;
        }
      } catch (e: unknown) {
        if (cancelled || !aliveRef.current) return;
        setError(e instanceof Error ? e.message : "status fetch failed");
      }
      if (cancelled || !aliveRef.current) return;
      timeoutRef.current = setTimeout(tick, intervalMs);
    }

    void tick();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsPolling(false);
    };
  }, [syncRunId, intervalMs]);

  return { status, isPolling, error };
}
