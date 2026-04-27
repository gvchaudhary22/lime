"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, GitPullRequest, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  AiplatformkbApiError,
  getFilterOptions,
  listPrs,
} from "@/lib/aiplatformkb-api";
import type {
  FilterOptions,
  PrListFilters,
  PrListResponse,
  ProcessingStatus,
} from "@/types/pr-feed";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import FilterBar from "@/components/pr-feed/FilterBar";
import PrTable from "@/components/pr-feed/PrTable";
import Pagination from "@/components/pr-feed/Pagination";
import RepoSyncButton from "@/components/pr-sync/RepoSyncButton";

const PAGE_SIZE = 50;
const PROCESSING_STATUSES: ProcessingStatus[] = [
  "pending",
  "processing",
  "done",
  "failed",
];

function parseFilters(sp: URLSearchParams): PrListFilters {
  const status = sp.get("processing_status");
  return {
    org: sp.get("org") || undefined,
    repo: sp.get("repo") || undefined,
    author: sp.get("author") || undefined,
    base_branch: sp.get("base_branch") || undefined,
    processing_status:
      status && (PROCESSING_STATUSES as string[]).includes(status)
        ? (status as ProcessingStatus)
        : undefined,
    merged_after: sp.get("merged_after") || undefined,
    merged_before: sp.get("merged_before") || undefined,
    q: sp.get("q") || undefined,
  };
}

function filtersToQuery(
  f: PrListFilters,
  offset: number
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  if (offset > 0) usp.set("offset", String(offset));
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default function PrFeedListPage() {
  return (
    <Suspense fallback={<ListPageFallback />}>
      <PrFeedListPageInner />
    </Suspense>
  );
}

function ListPageFallback() {
  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
      </div>
    </div>
  );
}

function PrFeedListPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const initialOffset = useMemo(() => {
    const raw = searchParams.get("offset");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  const [filters, setFilters] = useState<PrListFilters>(initialFilters);
  const [offset, setOffset] = useState(initialOffset);
  const debouncedFilters = useDebouncedValue(filters, 300);

  const [data, setData] = useState<PrListResponse | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Phase-13 RepoSyncButton bumps this to refetch the list after discovery.
  const [refetchTick, setRefetchTick] = useState(0);
  const refetch = () => setRefetchTick((n) => n + 1);

  // No token gate: PR Feed reads only auth-less aiplatformkb endpoints
  // (per ADR 006 — aiplatformkb is the public read-side of the sync_kb
  // pipeline). Other chat pages still require mars_token because they
  // call MARS, but this page does not.

  // Filter options (dropdown values) — fetched once.
  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {
        // Silent: dropdowns fall back to "All" only. Table fetch will
        // surface any backend availability problem.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Data fetch — re-runs when debounced filters / offset change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPrs(debouncedFilters, { limit: PAGE_SIZE, offset })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof AiplatformkbApiError
            ? `aiplatformkb ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Request failed";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, offset, refetchTick]);

  // URL querystring sync — push on filter/offset change.
  useEffect(() => {
    const qs = filtersToQuery(debouncedFilters, offset);
    router.replace(`/chat/pr-feed${qs}`, { scroll: false });
  }, [debouncedFilters, offset, router]);

  const handleFiltersChange = useCallback((next: PrListFilters) => {
    setFilters(next);
    setOffset(0);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({});
    setOffset(0);
  }, []);

  const handleRowClick = useCallback(
    (prId: number) => {
      router.push(`/chat/pr-feed/${prId}`);
    },
    [router]
  );

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-white/[0.06] px-8 pb-4 pt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <GitPullRequest className="h-6 w-6 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">PR Feed</h1>
            </div>
            <RepoSyncButton
              org={filters.org ?? null}
              repo={filters.repo ?? null}
              onDiscovered={(count) => {
                if (count > 0) refetch();
              }}
            />
          </div>
          <p className="text-sm text-slate-500">
            Merged PRs processed by sync_kb_from_prs with impact counts per
            run.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
          <FilterBar
            value={filters}
            options={options}
            onChange={handleFiltersChange}
            onReset={handleReset}
          />

          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {error ? (
              <div
                role="alert"
                data-testid="error-banner"
                className="flex items-center gap-3 px-4 py-6 text-sm text-rose-300"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : loading && !data ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              </div>
            ) : data ? (
              <>
                <PrTable items={data.items} onRowClick={handleRowClick} />
                <Pagination
                  total={data.total}
                  limit={data.limit}
                  offset={data.offset}
                  onChange={setOffset}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
