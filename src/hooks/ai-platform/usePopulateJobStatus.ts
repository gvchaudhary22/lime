// ai-platform replica of usePopulateJobStatus.

"use client";

import { useEffect, useRef, useState } from "react";

import { getPopulateJobStatus } from "@/lib/ai-platform-api";
import type { PopulateJobStatus } from "@/types/pr-sync";

const TERMINAL = new Set<PopulateJobStatus["status"]>([
  "done",
  "failed",
  "cancelled",
]);

export interface UsePopulateJobStatus {
  status: PopulateJobStatus | null;
  isPolling: boolean;
  error: string | null;
}

export function usePopulateJobStatus(
  prId: number | null,
  intervalMs: number = 2000,
): UsePopulateJobStatus {
  const [status, setStatus] = useState<PopulateJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const aliveRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    if (prId == null) {
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
        const s = await getPopulateJobStatus(prId!);
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
  }, [prId, intervalMs]);

  return { status, isPolling, error };
}
