// Phase-25 (Wave-3A) — polling hook for the async classify job.
//
// Mirrors `useDiscoverJobStatus` (Phase-23). Polls
// /admin/pr-sync/prs/{prId}/classify/status every `intervalMs`
// (default 2000ms) until status is terminal ("done" / "failed" /
// "cancelled"). Stops on unmount, on terminal, or when `prId` becomes
// null.
//
// We use a recursive setTimeout (rather than setInterval) so polls
// serialize — a slow tick can never overlap with the next one. The
// alive-guard ref prevents setState after unmount.

"use client";

import { useEffect, useRef, useState } from "react";

import { getClassifyJobStatus } from "@/lib/aiplatformkb-api";
import type { ClassifyJobStatus } from "@/types/pr-sync";

const TERMINAL = new Set<ClassifyJobStatus["status"]>([
  "done",
  "failed",
  "cancelled",
]);

export interface UseClassifyJobStatus {
  status: ClassifyJobStatus | null;
  isPolling: boolean;
  error: string | null;
}

export function useClassifyJobStatus(
  prId: number | null,
  intervalMs: number = 2000,
): UseClassifyJobStatus {
  const [status, setStatus] = useState<ClassifyJobStatus | null>(null);
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
        const s = await getClassifyJobStatus(prId!);
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
        // Continue polling — transient errors shouldn't permanently stop
        // the loop. Terminal status from the server is the only stop
        // condition.
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
