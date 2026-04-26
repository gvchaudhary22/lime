"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, GitPullRequest, Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  AiplatformkbApiError,
  getFilterOptions,
  getPrDetail,
} from "@/lib/aiplatformkb-api";
import type {
  ApiStatus,
  DeprecationState,
  FilterOptions,
  ImpactItem,
  ImpactStatus,
  ImpactType,
  PrDetailFilters,
  PrDetailResponse,
} from "@/types/pr-feed";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import PrHeaderCard from "@/components/pr-feed/PrHeaderCard";
import SyncRunSummary from "@/components/pr-feed/SyncRunSummary";
import ImpactsFilterBar from "@/components/pr-feed/ImpactsFilterBar";
import ImpactsTable from "@/components/pr-feed/ImpactsTable";
import ImpactDetailDrawer from "@/components/pr-feed/ImpactDetailDrawer";
import Pagination from "@/components/pr-feed/Pagination";
import RunPopulateButton from "@/components/pr-sync/RunPopulateButton";
import PopulateProgressBanner from "@/components/pr-sync/PopulateProgressBanner";
import { useSyncRowStatus } from "@/hooks/useSyncRowStatus";

const PAGE_SIZE = 50;

const IMPACT_STATUS_VALUES: ImpactStatus[] = [
  "impacted",
  "eligible_no_change",
  "deprecated_skipped",
  "new_pending",
];
const IMPACT_TYPE_VALUES: ImpactType[] = [
  "direct_route",
  "direct_controller",
  "direct_indirect",
];
const API_STATUS_VALUES: ApiStatus[] = ["new", "existing"];
const DEPRECATION_VALUES: DeprecationState[] = ["active", "deprecated"];

function parseFilters(sp: URLSearchParams): PrDetailFilters {
  const impactStatuses = sp
    .getAll("impact_status")
    .filter((s): s is ImpactStatus =>
      (IMPACT_STATUS_VALUES as string[]).includes(s)
    );
  const apiStatus = sp.get("api_status");
  const impactType = sp.get("impact_type");
  const deprecation = sp.get("deprecation_state");
  const minConfRaw = sp.get("min_confidence");
  const minConf = minConfRaw ? parseFloat(minConfRaw) : undefined;

  return {
    impact_status: impactStatuses.length > 0 ? impactStatuses : undefined,
    api_status:
      apiStatus && (API_STATUS_VALUES as string[]).includes(apiStatus)
        ? (apiStatus as ApiStatus)
        : undefined,
    impact_type:
      impactType && (IMPACT_TYPE_VALUES as string[]).includes(impactType)
        ? (impactType as ImpactType)
        : undefined,
    deprecation_state:
      deprecation && (DEPRECATION_VALUES as string[]).includes(deprecation)
        ? (deprecation as DeprecationState)
        : undefined,
    platform: sp.get("platform") || undefined,
    domain: sp.get("domain") || undefined,
    http_method: sp.get("http_method") || undefined,
    min_confidence:
      minConf !== undefined && Number.isFinite(minConf) && minConf > 0
        ? minConf
        : undefined,
    q: sp.get("q") || undefined,
  };
}

function filtersToQuery(f: PrDetailFilters, offset: number): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, String(item));
      continue;
    }
    usp.set(k, String(v));
  }
  if (offset > 0) usp.set("offset", String(offset));
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default function PrFeedDetailPage() {
  return (
    <Suspense fallback={<DetailPageFallback />}>
      <PrFeedDetailPageInner />
    </Suspense>
  );
}

function DetailPageFallback() {
  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
      </div>
    </div>
  );
}

function PrFeedDetailPageInner() {
  const router = useRouter();
  const params = useParams<{ prId: string }>();
  const searchParams = useSearchParams();
  const prId = params?.prId || "";

  const initialFilters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const initialOffset = useMemo(() => {
    const raw = searchParams.get("offset");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  const [filters, setFilters] = useState<PrDetailFilters>(initialFilters);
  const [offset, setOffset] = useState(initialOffset);
  const debouncedFilters = useDebouncedValue(filters, 300);

  const [data, setData] = useState<PrDetailResponse | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerImpact, setDrawerImpact] = useState<ImpactItem | null>(null);
  // Phase-13 Wave 3C — sync lifecycle for this PR. Polling tears down on
  // terminal states inside the hook.
  const prIdNum = useMemo(() => {
    const n = Number(prId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [prId]);
  const { status: syncStatus } = useSyncRowStatus(prIdNum, 2000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("mars_token");
    if (!token) router.push("/");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((opts) => {
        if (!cancelled) setOptions(opts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPrDetail(prId, debouncedFilters, { limit: PAGE_SIZE, offset })
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
  }, [prId, debouncedFilters, offset]);

  useEffect(() => {
    const qs = filtersToQuery(debouncedFilters, offset);
    router.replace(`/chat/pr-feed/${prId}${qs}`, { scroll: false });
  }, [prId, debouncedFilters, offset, router]);

  const handleFiltersChange = useCallback((next: PrDetailFilters) => {
    setFilters(next);
    setOffset(0);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({});
    setOffset(0);
  }, []);

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="pr-feed" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-white/[0.06] px-8 pb-4 pt-6">
          <button
            type="button"
            onClick={() => router.push("/chat/pr-feed")}
            className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-cyan-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to PR Feed
          </button>
          <div className="flex items-center gap-3">
            <GitPullRequest className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">
              PR Detail #{prId}
            </h1>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
          {error ? (
            <div
              role="alert"
              data-testid="error-banner"
              className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
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
              <PopulateProgressBanner status={syncStatus} />
              <div className="flex items-start justify-between gap-4">
                <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
                  <PrHeaderCard pr={data.pr} />
                  <SyncRunSummary syncRun={data.sync_run} />
                </div>
                {prIdNum != null && (
                  <RunPopulateButton
                    prId={prIdNum}
                    classifyStatus={syncStatus?.classify_status ?? null}
                    populateStatus={syncStatus?.populate_status ?? null}
                  />
                )}
              </div>

              <ImpactsFilterBar
                value={filters}
                options={options}
                onChange={handleFiltersChange}
                onReset={handleReset}
              />

              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <ImpactsTable
                  items={data.impacts.items}
                  onRowClick={setDrawerImpact}
                />
                <Pagination
                  total={data.impacts.total}
                  limit={data.impacts.limit}
                  offset={data.impacts.offset}
                  onChange={setOffset}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
      <ImpactDetailDrawer
        impact={drawerImpact}
        onClose={() => setDrawerImpact(null)}
      />
    </div>
  );
}
