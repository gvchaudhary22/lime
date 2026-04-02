"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database, GitBranch, Link2, Target, Play, Loader2,
  CheckCircle2, Clock, AlertCircle, RefreshCw, XCircle,
  Zap, Shield, Brain, FileCode, BarChart3,
} from "lucide-react";

const COSMOS_URL = process.env.NEXT_PUBLIC_COSMOS_URL || "http://localhost:10001";

interface PipelineStats {
  status: string;
  total_available_docs: number;
  available_by_source: Record<string, number>;
  embedding_stats: {
    available: boolean;
    total_embeddings?: number;
    by_entity_type?: Record<string, number>;
    by_repo?: Record<string, number>;
    active_embedding_model?: string;
    active_embedding_dim?: number;
    backend?: string;
    error?: string;
  };
  file_index: {
    indexed: number;
    pending: number;
    failed: number;
    total: number;
  };
}

interface MilestoneResult {
  milestone: number;
  name: string;
  success: boolean;
  documents_ingested: number;
  duration_ms: number;
  error: string | null;
  details: Record<string, unknown>;
}

interface PipelineResult {
  success: boolean;
  total_documents: number;
  total_duration_ms: number;
  milestones: MilestoneResult[];
}

type RunStatus = "idle" | "running" | "done" | "error";

const MILESTONE_META: Record<string, { icon: typeof Database; color: string; label: string }> = {
  split: { icon: Database, label: "M2: Split", color: "text-sky-400" },
  pillar1_schema_pillar3_apis: { icon: Database, label: "M5: Schema + APIs", color: "text-green-400" },
  pillar1_extras: { icon: GitBranch, label: "M5b: Schema Extras", color: "text-green-300" },
  pillar4_pillar5: { icon: FileCode, label: "M5c: Pages + Modules", color: "text-blue-400" },
  module_docs: { icon: FileCode, label: "M3: Module Docs", color: "text-blue-300" },
  pillar6_7_8: { icon: Shield, label: "M6: Actions + Workflows + Negatives", color: "text-orange-400" },
  entity_hubs: { icon: Link2, label: "M7: Entity Hubs", color: "text-purple-400" },
  generated_artifacts: { icon: Zap, label: "M4: Generated Artifacts", color: "text-yellow-400" },
  eval_seeds: { icon: Target, label: "Eval Seeds", color: "text-pink-400" },
  eval_seeds_autogen: { icon: Target, label: "Eval Auto-Generate", color: "text-pink-300" },
  kb_drift_check: { icon: AlertCircle, label: "KB Drift Check", color: "text-red-400" },
  enrichment: { icon: Brain, label: "Enrichment (Headers + Synthetic Q&A)", color: "text-cyan-400" },
  business_rules: { icon: Shield, label: "Pillar 2: Business Rules", color: "text-amber-400" },
  negative_examples: { icon: XCircle, label: "Pillar 8: Negatives Expansion", color: "text-red-300" },
  icrm_eval: { icon: BarChart3, label: "ICRM Eval Benchmark", color: "text-emerald-400" },
};

export default function TrainingPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [runDuration, setRunDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${COSMOS_URL}/cosmos/api/v1/pipeline/status`);
      if (!res.ok) { setError(`COSMOS returned ${res.status}`); return; }
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch {
      setError("Cannot connect to COSMOS at " + COSMOS_URL);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Disabled auto-polling — status endpoint reads 36K files and blocks COSMOS workers.
    // Click "Refresh" button manually to check stats.
  }, [fetchStats]);

  const runPipeline = async (endpoint: string, label: string) => {
    setRunStatus("running");
    setPipelineResult(null);
    setError(null);
    setRunDuration(0);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setRunDuration(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
    setTimerInterval(timer);

    try {
      const res = await fetch(`${COSMOS_URL}/cosmos/api/v1${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      clearInterval(timer);
      setTimerInterval(null);
      setRunDuration(Math.round((Date.now() - startTime) / 1000));

      if (!res.ok) {
        setRunStatus("error");
        setError(`Pipeline returned ${res.status}`);
        return;
      }

      const data = await res.json();
      setPipelineResult(data);
      setRunStatus("done");
      fetchStats(); // Refresh stats after pipeline completes
    } catch (e) {
      clearInterval(timer);
      setTimerInterval(null);
      setRunStatus("error");
      setError(`Pipeline failed: ${e}`);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerInterval) clearInterval(timerInterval); };
  }, [timerInterval]);

  const embedCount = stats?.embedding_stats?.total_embeddings || 0;
  const totalAvailable = stats?.total_available_docs || 0;
  const coverage = totalAvailable > 0 ? Math.round((embedCount / totalAvailable) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Training Pipeline</h2>
          <p className="text-xs text-slate-500">Ingest KB → Embed → Build Graph → Enrich → Evaluate</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/[0.1] text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
          <Database className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-green-400">{embedCount.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Embeddings</div>
        </div>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
          <FileCode className="w-5 h-5 text-blue-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-blue-400">{totalAvailable.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Available Docs</div>
        </div>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
          <Target className="w-5 h-5 text-purple-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-purple-400">{coverage}%</div>
          <div className="text-xs text-slate-500 mt-1">Coverage</div>
        </div>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
          <Zap className="w-5 h-5 text-orange-400 mx-auto mb-2" />
          <div className="text-3xl font-bold text-orange-400">
            {stats?.embedding_stats?.active_embedding_model?.replace("text-embedding-", "") || "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Embed Model</div>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">
            KB Coverage: {embedCount.toLocaleString()} / {totalAvailable.toLocaleString()} docs embedded
          </span>
          <span className="text-sky-400 font-medium">{coverage}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-sky-500 to-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(coverage, 100)}%` }}
          />
        </div>
      </div>

      {/* Available by Source */}
      {stats?.available_by_source && Object.keys(stats.available_by_source).length > 0 && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Available Documents by Source</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.available_by_source)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <div key={source} className="flex items-center justify-between p-2 bg-[#0a0e1a] rounded-lg">
                  <span className="text-xs text-slate-400 truncate">{source.replace(/_/g, " ")}</span>
                  <span className="text-xs font-semibold text-white ml-2">{count.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => runPipeline("/pipeline/run", "Full Pipeline")}
          disabled={runStatus === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runStatus === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {runStatus === "running" ? `Running... (${runDuration}s)` : "Run Full Pipeline"}
        </button>
        <button
          onClick={() => runPipeline("/pipeline/schema", "Schema + APIs")}
          disabled={runStatus === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#111830] border border-white/[0.06] hover:border-purple-500/30 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Database className="w-4 h-4" />
          Schema + APIs Only
        </button>
        <button
          onClick={() => runPipeline("/pipeline/modules", "Module Docs")}
          disabled={runStatus === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#111830] border border-white/[0.06] hover:border-purple-500/30 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileCode className="w-4 h-4" />
          Module Docs Only
        </button>
      </div>

      {/* Running Indicator */}
      {runStatus === "running" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <div>
            <p className="text-sm text-blue-300 font-medium">Pipeline running...</p>
            <p className="text-xs text-blue-400/60">
              Elapsed: {runDuration}s — This may take several minutes for full pipeline with enrichment.
            </p>
          </div>
        </div>
      )}

      {/* Pipeline Results */}
      {pipelineResult && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              {pipelineResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              Pipeline Result
            </h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{pipelineResult.total_documents.toLocaleString()} docs ingested</span>
              <span>{(pipelineResult.total_duration_ms / 1000).toFixed(1)}s total</span>
            </div>
          </div>

          {/* Milestone Results */}
          <div className="space-y-1.5">
            {pipelineResult.milestones?.map((m, i) => {
              const meta = MILESTONE_META[m.name] || { icon: Database, label: m.name, color: "text-slate-400" };
              const Icon = meta.icon;
              return (
                <div key={i} className="flex items-center justify-between p-2.5 bg-[#0a0e1a] rounded-lg">
                  <div className="flex items-center gap-3">
                    {m.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : m.error ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500" />
                    )}
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span className="text-sm text-white">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">{m.documents_ingested.toLocaleString()} docs</span>
                    <span className="text-slate-500">{(m.duration_ms / 1000).toFixed(1)}s</span>
                    {m.error && (
                      <span className="text-red-400 truncate max-w-48" title={m.error}>
                        {m.error.slice(0, 50)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Embedding Stats Breakdown */}
      {stats?.embedding_stats?.by_entity_type && Object.keys(stats.embedding_stats.by_entity_type).length > 0 && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Embeddings by Entity Type</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.embedding_stats.by_entity_type)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-36 truncate">{type}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(((count as number) / (embedCount || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-right">{(count as number).toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* By Repo */}
      {stats?.embedding_stats?.by_repo && Object.keys(stats.embedding_stats.by_repo).length > 0 && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Embeddings by Repository</h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stats.embedding_stats.by_repo).map(([repo, count]) => (
              <div key={repo} className="p-2 rounded-lg bg-[#0a0e1a] text-center">
                <p className="text-sm font-bold text-white">{(count as number).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 truncate">{repo}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
