"use client";

// ai-platform replica of /chat/pr-feed. Calls ai-platform's /kb/prs/list
// and /kb/sync/discover/* via the new client; presentation components
// (FilterBar, Pagination) are reused unchanged.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, GitPullRequest, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  AiPlatformApiError,
  getFilterOptions,
  listPrs,
} from "@/lib/ai-platform-api";
import type {
  FilterOptions,
  PrListFilters,
  PrListResponse,
  ProcessingStatus,
} from "@/types/pr-feed";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import FilterBar from "@/components/pr-feed/FilterBar";
import Pagination from "@/components/pr-feed/Pagination";
import PrTable from "./components/PrTable";
import RepoSyncButton from "@/components/pr-sync-ai-platform/RepoSyncButton";

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

function filtersToQuery(f: PrListFilters, offset: number): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  if (offset > 0) usp.set("offset", String(offset));
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default function PrFeedAiPlatformPage() {
  return (
    <Suspense fallback={<ListPageFallback />}>
      <PageInner />
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

function PageInner() {
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
  const [refetchTick, setRefetchTick] = useState(0);
  const refetch = () => setRefetchTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((opts) => { if (!cancelled) setOptions(opts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPrs(debouncedFilters, { limit: PAGE_SIZE, offset })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof AiPlatformApiError
            ? `ai-platform ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Request failed";
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedFilters, offset, refetchTick]);

  useEffect(() => {
    const qs = filtersToQuery(debouncedFilters, offset);
    router.replace(`/chat/pr-feed-ai-platform${qs}`, { scroll: false });
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
      router.push(`/chat/pr-feed-ai-platform/${prId}`);
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
              <h1 className="text-2xl font-bold text-white">PR Feed — ai-platform</h1>
            </div>
            <RepoSyncButton
              org={filters.org ?? null}
              repo={filters.repo ?? null}
              onDiscovered={(count) => { if (count > 0) refetch(); }}
            />
          </div>
          <p className="text-sm text-slate-500">
            Merged PRs surfaced by ai-platform&apos;s /kb/prs/list with impact
            counts per sync run.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
          <FilterBar
            value={filters}
            options={options}
            onChange={handleFiltersChange}
            onReset={handleReset}
            showAuthor={false}
            showBaseBranch={false}
            showSearch={false}
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
                <div className="overflow-x-auto">
                  <PrTable
                    items={data.items}
                    onRowClick={handleRowClick}
                    onClassified={() => refetch()}
                  />
                </div>
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
