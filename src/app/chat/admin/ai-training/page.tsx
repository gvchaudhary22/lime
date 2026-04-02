"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { api, RegistryResetResult } from "@/lib/api";
import {
  Brain,
  Play,
  RefreshCw,
  Database,
  Zap,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Filter,
  CheckSquare,
  Square,
  Trash2,
} from "lucide-react";

const COSMOS_URL =
  process.env.NEXT_PUBLIC_COSMOS_URL || "http://localhost:10001";

// Available repos for training
const REPOS = [
  { id: "MultiChannel_API", label: "MultiChannel API", pillar1: true, pillar3: true, pillar4: false, pillar5: false, desc: "Backend API — orders, shipments, billing" },
  { id: "SR_Web", label: "SR Web (Seller)", pillar1: false, pillar3: true, pillar4: true, pillar5: true, desc: "Seller panel — Angular frontend" },
  { id: "MultiChannel_Web", label: "MultiChannel Web (ICRM)", pillar1: false, pillar3: true, pillar4: true, pillar5: true, desc: "ICRM admin panel — AngularJS" },
];

interface FileIndexStats {
  indexed: number;
  pending: number;
  failed: number;
  total: number;
  by_repo?: Record<string, { indexed: number; pending: number; failed: number; total: number }>;
}

interface EmbeddingStats {
  total_embeddings: number;
  by_entity_type: Record<string, number>;
  by_repo: Record<string, number>;
  by_trust_tier?: Record<string, number>;
  by_embedding_model?: Record<string, number>;
  active_embedding_model: string;
  active_embedding_dim?: number;
  backend: string;
  latest_embedding_at: string | null;
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

type JobStatus = "idle" | "running" | "done" | "error";

async function cosmosRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${COSMOS_URL}/cosmos/api/v1${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function AITrainingPage() {
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [fileIndex, setFileIndex] = useState<FileIndexStats | null>(null);
  const [totalAvailableDocs, setTotalAvailableDocs] = useState<number>(0);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<string[]>(["MultiChannel_API"]);
  const [jobStatus, setJobStatus] = useState<Record<string, JobStatus>>({
    pipeline: "idle",
    schema: "idle",
    seeds: "idle",
    artifacts: "idle",
    moduledocs: "idle",
    intent: "idle",
    graph: "idle",
    pageRole: "idle",
    crossRepo: "idle",
    moduleEmbeddings: "idle",
  });
  const [jobResults, setJobResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [resetResult, setResetResult] = useState<RegistryResetResult | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<"pipeline" | "all" | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await cosmosRequest<{
        error?: string;
        embedding_stats?: EmbeddingStats;
        file_index?: FileIndexStats;
        total_available_docs?: number;
      } & EmbeddingStats>("/pipeline/status");
      if ("error" in data && data.error) {
        setError(data.error as string);
      } else if ("embedding_stats" in data && data.embedding_stats) {
        setStats(data.embedding_stats);
        if (data.file_index) setFileIndex(data.file_index);
        if (data.total_available_docs) setTotalAvailableDocs(data.total_available_docs);
        setError(null);
      } else {
        setStats(data as EmbeddingStats);
        setError(null);
      }
    } catch {
      setError("Cannot connect to COSMOS at " + COSMOS_URL);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const toggleRepo = (repoId: string) => {
    setSelectedRepos((prev) =>
      prev.includes(repoId)
        ? prev.filter((r) => r !== repoId)
        : [...prev, repoId]
    );
  };

  const selectAll = () => {
    setSelectedRepos(REPOS.map((r) => r.id));
  };

  const runJob = async (
    key: string,
    endpoint: string,
    body?: unknown
  ) => {
    setJobStatus((prev) => ({ ...prev, [key]: "running" }));
    setJobResults((prev) => ({ ...prev, [key]: "" }));
    try {
      const result = await cosmosRequest<PipelineResult | Record<string, unknown>>(endpoint, "POST", body);
      setJobStatus((prev) => ({ ...prev, [key]: "done" }));

      // Extract summary
      const r = result as Record<string, unknown>;
      const docs = r.documents || r.total_documents || 0;
      const success = r.success !== false;
      setJobResults((prev) => ({
        ...prev,
        [key]: success ? `${docs} docs ingested` : `Failed: ${r.error || "unknown"}`,
      }));

      if (key === "pipeline") {
        setPipelineResult(result as PipelineResult);
      }
      setTimeout(fetchStats, 2000);
    } catch {
      setJobStatus((prev) => ({ ...prev, [key]: "error" }));
      setJobResults((prev) => ({ ...prev, [key]: "Connection failed" }));
    }
  };

  const handleRegistryReset = async (includeSeeds: boolean) => {
    setShowResetConfirm(null);
    setResetStatus("running");
    setResetResult(null);
    const res = await api.resetRegistry(includeSeeds);
    if (res.success && res.data) {
      setResetResult(res.data);
      setResetStatus("done");
    } else {
      setResetStatus("error");
    }
  };

  const statusBadge = (status: JobStatus, resultText?: string) => {
    const icon = {
      running: <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />,
      done: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
      error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
      idle: <Clock className="w-3.5 h-3.5 text-slate-500" />,
    }[status];

    return (
      <div className="flex items-center gap-1.5">
        {icon}
        {resultText && (
          <span className={`text-xs ${status === "error" ? "text-red-400" : "text-slate-400"}`}>
            {resultText}
          </span>
        )}
      </div>
    );
  };

  const totalAvailable = totalAvailableDocs || fileIndex?.total || stats?.total_embeddings || 0;
  const totalFed = stats?.total_embeddings || 0;
  const coverage = totalAvailable > 0 ? Math.round((totalFed / totalAvailable) * 100) : 0;
  const repoParam = selectedRepos.length === 1 ? { repo_id: selectedRepos[0] } : {};

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar activePage="admin-ai-training" />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-sky-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">AI Training</h1>
                <p className="text-sm text-slate-400">
                  Feed knowledge base, train models, monitor embeddings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/chat/admin/ai-training/simulation"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-300 hover:text-yellow-200 text-sm"
              >
                <Zap className="w-4 h-4" />
                Simulation
              </a>
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/[0.1] transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Repo Selector */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-400" />
                Select Repositories
              </h2>
              <button
                onClick={selectAll}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {REPOS.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => toggleRepo(repo.id)}
                  className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                    selectedRepos.includes(repo.id)
                      ? "border-sky-500/30 bg-sky-500/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  {selectedRepos.includes(repo.id) ? (
                    <CheckSquare className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">{repo.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{repo.desc}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {repo.pillar1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">P1 Schema</span>}
                      {repo.pillar3 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">P3 APIs</span>}
                      {repo.pillar4 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">P4 Pages</span>}
                      {repo.pillar5 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">P5 Modules</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Selected: {selectedRepos.length === 0 ? "None" : selectedRepos.join(", ")}
            </p>
          </div>

          {/* Data Ingestion */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-400" />
              Data Ingestion
            </h2>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">
                  KB Coverage: {totalFed.toLocaleString()} / {totalAvailable > 0 ? totalAvailable.toLocaleString() : "—"} docs
                  {fileIndex && <span className="text-slate-500 ml-1">({fileIndex.indexed} indexed, {fileIndex.pending} pending)</span>}
                </span>
                <span className="text-sky-400 font-medium">{coverage}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-sky-500 to-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(coverage, 100)}%` }}
                />
              </div>
            </div>

            {/* Ingestion Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Full Pipeline */}
              <button
                onClick={() => runJob("pipeline", "/pipeline/run", repoParam)}
                disabled={jobStatus.pipeline === "running" || selectedRepos.length === 0}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all col-span-2"
              >
                <div className="flex items-center gap-2">
                  {jobStatus.pipeline === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run Full Pipeline ({selectedRepos.length} repo{selectedRepos.length !== 1 ? "s" : ""})
                </div>
                {statusBadge(jobStatus.pipeline, jobResults.pipeline)}
              </button>

              {/* Individual sources */}
              {[
                { key: "schema", label: "Feed Schema (Pillar 1)", endpoint: "/pipeline/schema", desc: "Tables, columns, state machines" },
                { key: "seeds", label: "Feed Eval Seeds", endpoint: "/pipeline/seeds", desc: "Labeled query→tool examples" },
                { key: "artifacts", label: "Feed Generated Artifacts", endpoint: "/pipeline/artifacts", desc: "Domain overviews, symptom fixes" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => runJob(item.key, item.endpoint, repoParam)}
                  disabled={jobStatus[item.key] === "running" || selectedRepos.length === 0}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white disabled:opacity-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.desc}</p>
                  </div>
                  {statusBadge(jobStatus[item.key], jobResults[item.key])}
                </button>
              ))}

              {/* Pillar 5 — Module Docs (only for frontend repos) */}
              {selectedRepos.some((id) => REPOS.find((r) => r.id === id)?.pillar5) && (
                <button
                  onClick={() => runJob("moduledocs", "/pipeline/pillar5-modules", repoParam)}
                  disabled={jobStatus.moduledocs === "running" || selectedRepos.length === 0}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-200 hover:bg-violet-500/20 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">Feed Module Docs (Pillar 5)</p>
                    <p className="text-[10px] text-violet-400/70">Module-level documentation for AI context</p>
                  </div>
                  {statusBadge(jobStatus.moduledocs, jobResults.moduledocs)}
                </button>
              )}
            </div>

            {/* Pipeline Result */}
            {pipelineResult && (
              <div className="mt-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <h3 className="text-sm font-medium text-white mb-2">Pipeline Result</h3>
                <div className="flex gap-4 text-sm mb-3">
                  <span className={pipelineResult.success ? "text-green-400" : "text-red-400"}>
                    {pipelineResult.success ? "Success" : "Failed"}
                  </span>
                  <span className="text-slate-400">{pipelineResult.total_documents} docs</span>
                  <span className="text-slate-400">{(pipelineResult.total_duration_ms / 1000).toFixed(1)}s</span>
                </div>
                <div className="space-y-1">
                  {pipelineResult.milestones?.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{m.documents_ingested} docs</span>
                        {m.success ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Model Training */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Model Training
            </h2>
            <div className="space-y-3">
              {[
                { key: "intent", label: "Intent Classifier", endpoint: "/training/intent-classifier", desc: "Trains query → intent routing" },
                { key: "graph", label: "Graph Weights", endpoint: "/training/graph-weights", desc: "Optimizes graph edge weights" },
                { key: "pageRole", label: "Page-Role Embeddings", endpoint: "/training/page-role", desc: "Embeds pages + roles", needsRepo: true },
                { key: "crossRepo", label: "Cross-Repo Navigation", endpoint: "/training/cross-repo", desc: "Links seller ↔ admin pages", needsRepo: true },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    {statusBadge(jobStatus[item.key])}
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {jobResults[item.key] && (
                      <span className="text-xs text-slate-500">{jobResults[item.key]}</span>
                    )}
                    <button
                      onClick={() => {
                        const body = item.needsRepo && selectedRepos.length === 1 ? { repo_id: selectedRepos[0] } : {};
                        runJob(item.key, item.endpoint, body);
                      }}
                      disabled={jobStatus[item.key] === "running"}
                      className="px-3 py-1.5 rounded-md bg-white/[0.05] text-sm text-slate-300 hover:bg-white/[0.1] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {jobStatus[item.key] === "running" ? "Training..." : "Train Now"}
                    </button>
                  </div>
                </div>
              ))}

              {/* Module Embeddings — Pillar 5 only (frontend repos) */}
              {selectedRepos.some((id) => REPOS.find((r) => r.id === id)?.pillar5) && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-3">
                    {statusBadge(jobStatus.moduleEmbeddings)}
                    <div>
                      <p className="text-sm font-medium text-white">Module Embeddings</p>
                      <p className="text-xs text-violet-400/70">Embeds module-level docs for semantic retrieval</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {jobResults.moduleEmbeddings && (
                      <span className="text-xs text-slate-500">{jobResults.moduleEmbeddings}</span>
                    )}
                    <button
                      onClick={() => {
                        const body = selectedRepos.length === 1 ? { repo_id: selectedRepos[0] } : {};
                        runJob("moduleEmbeddings", "/training/module-embeddings", body);
                      }}
                      disabled={jobStatus.moduleEmbeddings === "running"}
                      className="px-3 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300 hover:bg-violet-500/20 hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {jobStatus.moduleEmbeddings === "running" ? "Training..." : "Train Now"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Embeddings Stats */}
          {stats && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Embedding Stats
              </h2>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-2xl font-bold text-white">{stats.total_embeddings?.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-400">Total</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-sm font-medium text-sky-400">{stats.active_embedding_model || "—"}</p>
                  <p className="text-xs text-slate-400">Model</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-sm font-medium text-green-400">{stats.active_embedding_dim || "—"}</p>
                  <p className="text-xs text-slate-400">Dimensions</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-sm font-medium text-purple-400">{stats.backend || "—"}</p>
                  <p className="text-xs text-slate-400">Backend</p>
                </div>
              </div>

              {/* By Entity Type */}
              {stats.by_entity_type && Object.keys(stats.by_entity_type).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">By Entity Type</h3>
                  <div className="space-y-1.5">
                    {Object.entries(stats.by_entity_type)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-28 truncate">{type}</span>
                          <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                            <div
                              className="bg-sky-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(((count as number) / (stats.total_embeddings || 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-12 text-right">{(count as number).toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* By Repo */}
              {stats.by_repo && Object.keys(stats.by_repo).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">By Repository</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(stats.by_repo).map(([repo, count]) => (
                      <div key={repo} className="p-2 rounded-lg bg-white/[0.03] text-center">
                        <p className="text-sm font-bold text-white">{(count as number).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 truncate">{repo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trust Tiers */}
              {stats.by_trust_tier && Object.keys(stats.by_trust_tier).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Trust Tiers</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(stats.by_trust_tier).map(([tier, count]) => (
                      <div key={tier} className={`p-2 rounded-lg text-center ${
                        tier === "tier_A" ? "bg-green-500/10 border border-green-500/20" :
                        tier === "tier_B" ? "bg-blue-500/10 border border-blue-500/20" :
                        tier === "tier_C" ? "bg-yellow-500/10 border border-yellow-500/20" :
                        "bg-slate-500/10 border border-slate-500/20"
                      }`}>
                        <p className="text-sm font-bold text-white">{(count as number).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{tier.replace("_", " ").toUpperCase()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.latest_embedding_at && (
                <p className="text-xs text-slate-500 mt-3">
                  Last: {new Date(stats.latest_embedding_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Registry Reset */}
          <div className="rounded-xl bg-red-500/[0.03] border border-red-500/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Registry Reset
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Clear tools, skills, actions, and agents stored by the training pipeline so you can re-run a clean ingestion.
            </p>

            {resetResult && resetStatus === "done" && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-300">
                Deleted — tools: {resetResult.deleted_tools}, skills: {resetResult.deleted_skills}, actions: {resetResult.deleted_actions}, agents: {resetResult.deleted_agents}
                {resetResult.include_seeds && " (seeds included)"}
              </div>
            )}
            {resetStatus === "error" && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                Reset failed. Check API connectivity.
              </div>
            )}

            {showResetConfirm && (
              <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-300 mb-3">
                  {showResetConfirm === "all"
                    ? "This will delete ALL registry entries including seeds. Are you sure?"
                    : "This will delete pipeline-generated entries (not seeds). Continue?"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRegistryReset(showResetConfirm === "all")}
                    className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
                  >
                    Yes, Reset
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(null)}
                    className="px-3 py-1.5 rounded-md bg-white/[0.05] text-slate-300 text-sm hover:bg-white/[0.1] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm("pipeline")}
                disabled={resetStatus === "running" || !!showResetConfirm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {resetStatus === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Reset Pipeline Data
              </button>
              <button
                onClick={() => setShowResetConfirm("all")}
                disabled={resetStatus === "running" || !!showResetConfirm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700/10 border border-red-700/30 text-red-500 text-sm hover:bg-red-700/20 transition-colors disabled:opacity-50"
              >
                {resetStatus === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Reset All (incl. Seeds)
              </button>
            </div>
          </div>

          {/* Tournament A/B */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              Tournament A/B
            </h2>
            <p className="text-sm text-slate-400 mb-3">
              ICRM users see blind A/B answers on low-confidence queries. Preferences improve retrieval.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "View Stats", endpoint: "/tournament/stats" },
                { label: "Failure Report", endpoint: "/tournament/failures" },
                { label: "Needs Annotation", endpoint: "/tournament/needs-annotation" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={async () => {
                    try {
                      const data = await cosmosRequest(item.endpoint);
                      alert(JSON.stringify(data, null, 2));
                    } catch {
                      alert("Failed to fetch");
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-white/[0.05] text-sm text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
