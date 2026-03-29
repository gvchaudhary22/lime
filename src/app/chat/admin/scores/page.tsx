"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Loader2,
  RefreshCw,
  TrendingUp,
  FileText,
  Cpu,
  Zap,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/lib/api";
import type { ScoreDashboardResponse } from "@/lib/api";

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function impactBadge(impact: string) {
  const upper = impact.toUpperCase();
  if (upper === "HIGH")
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
        HIGH
      </span>
    );
  if (upper === "MEDIUM")
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
        MEDIUM
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
      LOW
    </span>
  );
}

export default function ScoresDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ScoreDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>("repo");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getScoreDashboard();
      if (res.success && res.data) setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVulnScan = async () => {
    setScanning(true);
    try {
      await api.triggerVulnerabilityScan();
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroup(expandedGroup === group ? null : group);
  };

  // Categorize suggestions
  const repoSuggestions =
    data?.suggestions.filter(
      (s) => s.dimension === "Enrichment" || s.dimension === "Deep Enrichment"
    ) || [];
  const orchestratorSuggestions =
    data?.suggestions.filter((s) => s.dimension.startsWith("Orchestrator:")) ||
    [];
  const infraSuggestions =
    data?.suggestions.filter(
      (s) =>
        s.dimension.startsWith("Observability:") ||
        s.dimension.startsWith("Cross-Repo:")
    ) || [];

  const maxScore =
    data?.repos && data.repos.length > 0
      ? Math.max(...data.repos.map((r) => r.context_score), 1)
      : 100;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-semibold text-slate-100">
                Score Dashboard
              </h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleVulnScan}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                Run Vulnerability Scan
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-700 transition disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Orchestrator Score */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Cpu className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-slate-400">
                    Orchestrator Score
                  </span>
                </div>
                <div
                  className={`text-3xl font-bold ${scoreTextColor(data.orchestrator_score)}`}
                >
                  {data.orchestrator_score}
                  <span className="text-lg text-slate-500">/100</span>
                </div>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${scoreColor(data.orchestrator_score)}`}
                    style={{ width: `${data.orchestrator_score}%` }}
                  />
                </div>
              </div>

              {/* Total Repos */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-medium text-slate-400">
                    Repositories
                  </span>
                </div>
                <div className="text-3xl font-bold text-slate-100">
                  {data.repos.length}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Avg score:{" "}
                  {data.repos.length > 0
                    ? (
                        data.repos.reduce(
                          (sum, r) => sum + r.context_score,
                          0
                        ) / data.repos.length
                      ).toFixed(1)
                    : "N/A"}
                </div>
              </div>

              {/* Total Doc Files */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-medium text-slate-400">
                    Doc Files
                  </span>
                </div>
                <div className="text-3xl font-bold text-slate-100">
                  {data.total_doc_files}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Across all repos
                </div>
              </div>
            </div>

            {/* Repo Score Bar Chart */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">
                Repository Context Scores
              </h2>
              {data.repos.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No repositories found.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.repos.map((repo) => (
                    <div key={repo.id} className="flex items-center gap-4">
                      <div className="w-48 truncate text-sm text-slate-300">
                        {repo.name || repo.slug}
                      </div>
                      <div className="flex-1 bg-slate-700 rounded-full h-5 relative">
                        <div
                          className={`h-5 rounded-full ${scoreColor(repo.context_score)} transition-all duration-500`}
                          style={{
                            width: `${maxScore > 0 ? (repo.context_score / maxScore) * 100 : 0}%`,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow">
                          {repo.context_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Improvement Suggestions */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-slate-200">
                  Improvement Suggestions
                </h2>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">
                  {data.suggestions.length} items
                </span>
              </div>

              {/* Repo Suggestions Group */}
              {repoSuggestions.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => toggleGroup("repo")}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100 mb-2"
                  >
                    {expandedGroup === "repo" ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Per-Repo Enrichment ({repoSuggestions.length})
                  </button>
                  {expandedGroup === "repo" && (
                    <div className="space-y-2 ml-6">
                      {repoSuggestions.map((s, i) => (
                        <SuggestionRow key={`repo-${i}`} s={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Orchestrator Suggestions Group */}
              {orchestratorSuggestions.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => toggleGroup("orchestrator")}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100 mb-2"
                  >
                    {expandedGroup === "orchestrator" ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Orchestrator ({orchestratorSuggestions.length})
                  </button>
                  {expandedGroup === "orchestrator" && (
                    <div className="space-y-2 ml-6">
                      {orchestratorSuggestions.map((s, i) => (
                        <SuggestionRow key={`orch-${i}`} s={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Infra Suggestions Group */}
              {infraSuggestions.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => toggleGroup("infra")}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100 mb-2"
                  >
                    {expandedGroup === "infra" ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Infrastructure ({infraSuggestions.length})
                  </button>
                  {expandedGroup === "infra" && (
                    <div className="space-y-2 ml-6">
                      {infraSuggestions.map((s, i) => (
                        <SuggestionRow key={`infra-${i}`} s={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500">
            Failed to load dashboard data.
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionRow({
  s,
}: {
  s: {
    dimension: string;
    current: number;
    target: number;
    action: string;
    impact: string;
    effort: string;
  };
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-200">
            {s.dimension}
          </span>
          {impactBadge(s.impact)}
        </div>
        <p className="text-sm text-slate-400 leading-snug">{s.action}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-center">
          <div className={`text-sm font-bold ${scoreTextColor(s.current)}`}>
            {s.current}
          </div>
          <div className="text-[10px] text-slate-500 uppercase">Current</div>
        </div>
        <span className="text-slate-600">-&gt;</span>
        <div className="text-center">
          <div className="text-sm font-bold text-green-400">{s.target}</div>
          <div className="text-[10px] text-slate-500 uppercase">Target</div>
        </div>
        <div className="text-center ml-2">
          <div className="text-xs text-slate-400">{s.effort}</div>
          <div className="text-[10px] text-slate-500 uppercase">Effort</div>
        </div>
      </div>
    </div>
  );
}
