"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import {
  Brain, Play, Loader2, CheckCircle, XCircle, Clock, Zap,
  Search, Database, GitBranch, Shield, MessageSquare, ChevronDown,
  ChevronRight, History, AlertTriangle, RefreshCw,
} from "lucide-react";

const COSMOS_URL =
  process.env.NEXT_PUBLIC_COSMOS_URL || "http://localhost:10001";

interface WaveResult {
  name: string;
  status: "idle" | "running" | "done" | "error" | "skipped";
  latency_ms?: number;
  data?: Record<string, unknown>;
  summary?: string;
}

interface SimulationResult {
  query: string;
  final_response: string;
  confidence: number;
  total_latency_ms: number;
  waves: WaveResult[];
  tools_used: string[];
  agent_chain?: string[];
  guardrails_pre: number;
  guardrails_post: number;
  pattern_hit: boolean;
  timestamp: string;
  raw_debug?: Record<string, unknown>;
}

interface HistoryEntry {
  query: string;
  response: string;
  confidence: number;
  latency_ms: number;
  tools: string[];
  agents: string[];
  timestamp: string;
  tier: number;
  success: boolean;
}

export default function SimulationPage() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedWave, setExpandedWave] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from COSMOS analytics
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${COSMOS_URL}/cosmos/api/v1/hybrid/analytics`);
      if (res.ok) {
        const data = await res.json();
        if (data.recent_queries) {
          setHistory(data.recent_queries.slice(0, 20).map((q: Record<string, unknown>) => ({
            query: q.query as string || "",
            response: (q.response as string || "").slice(0, 200),
            confidence: q.confidence as number || 0,
            latency_ms: q.total_latency_ms as number || 0,
            tools: (q.tools_used as string[]) || [],
            agents: (q.agent_chain as string[]) || [],
            timestamp: q.timestamp as string || new Date().toISOString(),
            tier: q.tier as number || 1,
            success: (q.confidence as number || 0) >= 0.5,
          })));
        }
      }
    } catch {
      // Analytics endpoint may not be available
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runSimulation = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setExpandedWave(null);

    // Initialize waves
    const waves: WaveResult[] = [
      { name: "Wave 1: Probe", status: "running" },
      { name: "Wave 2: Deep GraphRAG", status: "idle" },
      { name: "Wave 3: LangGraph", status: "idle" },
      { name: "Wave 4: Neo4j", status: "idle" },
      { name: "Wave 5: RIPER + ReAct", status: "idle" },
    ];
    setResult({
      query, final_response: "", confidence: 0, total_latency_ms: 0,
      waves, tools_used: [], guardrails_pre: 0, guardrails_post: 0,
      pattern_hit: false, timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch(`${COSMOS_URL}/cosmos/api/v1/hybrid/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          user_id: "simulation_user",
          debug: true,
          metadata: { simulation: true },
        }),
      });

      if (!res.ok) {
        setError(`COSMOS returned ${res.status}`);
        setRunning(false);
        return;
      }

      const data = await res.json();

      // Parse debug data into wave results
      const pb = data.pipeline_breakdown || {};
      const timing = data.timing || {};
      const signal = data.signal || {};
      const classification = pb._request_classification || {};
      const riper = pb._riper || {};
      const ralph = pb._ralph || {};
      const forge = pb._agent_forge || {};
      const w3 = pb._wave3_langgraph || {};
      const w4 = pb._wave4_neo4j || {};

      const parsedWaves: WaveResult[] = [
        {
          name: "Wave 1: Probe",
          status: "done",
          latency_ms: timing.probe_ms || 0,
          summary: `Intent: ${classification.domain || "?"} | Complexity: ${classification.complexity || "?"} | Confidence: ${classification.confidence || 0}`,
          data: {
            intent: classification,
            pipelines: Object.entries(pb)
              .filter(([k]) => !k.startsWith("_"))
              .map(([k, v]) => ({ pipeline: k, ...(v as Record<string, unknown>) })),
          },
        },
        {
          name: "Wave 2: Deep GraphRAG",
          status: timing.deep_ms ? "done" : "skipped",
          latency_ms: timing.deep_ms || 0,
          summary: `Evidence: ${signal.evidence_count || 0} sources | Entity resolved: ${signal.entity_resolved ? "Yes" : "No"}`,
          data: {
            evidence_count: signal.evidence_count,
            entity_resolved: signal.entity_resolved,
            tier: signal.tier,
          },
        },
        {
          name: "Wave 3: LangGraph",
          status: w3 && Object.keys(w3).length > 0 ? "done" : "skipped",
          latency_ms: w3?.latency_ms || 0,
          summary: w3?.refined_entities
            ? `Refined ${w3.refined_entities.length} entities | Tools: ${w3.tool_plan?.join(", ") || "none"}`
            : "Not triggered (feature flag or quick query)",
          data: w3,
        },
        {
          name: "Wave 4: Neo4j",
          status: w4 && Object.keys(w4).length > 0 ? "done" : "skipped",
          latency_ms: w4?.latency_ms || 0,
          summary: w4?.path_count
            ? `${w4.path_count} graph nodes | ${w4.entity_targets_used || 0} entity targets`
            : "Not triggered",
          data: w4,
        },
        {
          name: "Wave 5: RIPER + ReAct",
          status: data.content ? "done" : "error",
          latency_ms: timing.llm_ms || 0,
          summary: riper
            ? `${riper.mode || "lite"} | ${riper.phases?.length || 0} phases | Quality: ${riper.quality_score || "?"}`
            : `Direct ReAct | Confidence: ${data.confidence || 0}`,
          data: {
            riper,
            ralph,
            forge: forge && Object.keys(forge).length > 0 ? forge : undefined,
            tools_used: data.tools_used || [],
          },
        },
      ];

      setResult({
        query,
        final_response: data.content || "No response",
        confidence: data.confidence || 0,
        total_latency_ms: timing.total_ms || timing.probe_ms + (timing.deep_ms || 0) + (timing.llm_ms || 0),
        waves: parsedWaves,
        tools_used: data.tools_used || [],
        agent_chain: pb._agent_forge ? [pb._agent_forge.agent_name] : [],
        guardrails_pre: 15,
        guardrails_post: 10,
        pattern_hit: (data.pipeline_breakdown?.fast_path) || false,
        timestamp: new Date().toISOString(),
        raw_debug: data,
      });

    } catch (e) {
      setError(`Failed to connect: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  const waveIcon = (status: string) => {
    switch (status) {
      case "running": return <Loader2 className="w-4 h-4 animate-spin text-sky-400" />;
      case "done": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "error": return <XCircle className="w-4 h-4 text-red-400" />;
      case "skipped": return <Clock className="w-4 h-4 text-slate-500" />;
      default: return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const confColor = (c: number) => c >= 0.8 ? "text-green-400" : c >= 0.5 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar activePage="admin-ai-training" />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Pipeline Simulation</h1>
                <p className="text-sm text-slate-400">
                  Test queries and see all 5 waves execute in real-time
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/[0.1] text-sm"
            >
              <History className="w-4 h-4" />
              {showHistory ? "Hide History" : "Query History"}
            </button>
          </div>

          {/* Query Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !running && runSimulation()}
              placeholder="Ask a question... (e.g., 'Order 12345 ka status kya hai?')"
              className="flex-1 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={runSimulation}
              disabled={running || !query.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Running..." : "Simulate"}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Wave Results */}
          {result && (
            <div className="space-y-3">
              {result.waves.map((wave, i) => (
                <div key={i} className={`rounded-xl border transition-all ${
                  wave.status === "done" ? "border-green-500/20 bg-green-500/5" :
                  wave.status === "running" ? "border-sky-500/30 bg-sky-500/5" :
                  wave.status === "error" ? "border-red-500/20 bg-red-500/5" :
                  "border-white/[0.06] bg-white/[0.02]"
                }`}>
                  <button
                    onClick={() => setExpandedWave(expandedWave === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {waveIcon(wave.status)}
                      <span className="text-sm font-medium text-white">{wave.name}</span>
                      {wave.latency_ms !== undefined && wave.latency_ms > 0 && (
                        <span className="text-xs text-slate-500">{Math.round(wave.latency_ms)}ms</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {wave.summary && (
                        <span className="text-xs text-slate-400 max-w-md truncate">{wave.summary}</span>
                      )}
                      {expandedWave === i ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {expandedWave === i && wave.data && (
                    <div className="px-4 pb-4 border-t border-white/[0.06]">
                      <pre className="mt-3 p-3 rounded-lg bg-slate-900/80 text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(wave.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Final Answer */}
              {result.final_response && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                      Final Response
                    </h3>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={confColor(result.confidence)}>
                        Confidence: {(result.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-slate-500">
                        {Math.round(result.total_latency_ms)}ms total
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.final_response}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.tools_used.map((tool, i) => (
                      <span key={i} className="px-2 py-1 text-[10px] rounded bg-green-500/20 text-green-300">{tool}</span>
                    ))}
                    {result.agent_chain?.map((agent, i) => (
                      <span key={i} className="px-2 py-1 text-[10px] rounded bg-purple-500/20 text-purple-300">Agent: {agent}</span>
                    ))}
                    {result.pattern_hit && (
                      <span className="px-2 py-1 text-[10px] rounded bg-yellow-500/20 text-yellow-300">Fast Path</span>
                    )}
                  </div>

                  <div className="mt-3 flex gap-4 text-[10px] text-slate-500">
                    <span><Shield className="w-3 h-3 inline mr-1" />Pre: {result.guardrails_pre} guards</span>
                    <span><Shield className="w-3 h-3 inline mr-1" />Post: {result.guardrails_post} guards</span>
                  </div>
                </div>
              )}

              {/* Raw Debug */}
              {result.raw_debug && (
                <details className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <summary className="p-4 text-sm text-slate-400 cursor-pointer hover:text-white">
                    Raw Debug Data (click to expand)
                  </summary>
                  <pre className="p-4 text-xs text-slate-400 overflow-x-auto max-h-96 overflow-y-auto border-t border-white/[0.06]">
                    {JSON.stringify(result.raw_debug, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* History Panel */}
          {showHistory && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-400" />
                  Recent ICRM Queries
                </h2>
                <button onClick={loadHistory} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-slate-500">No recent queries found. Run a simulation first.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.map((h, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] cursor-pointer hover:bg-white/[0.06]"
                      onClick={() => { setQuery(h.query); setShowHistory(false); }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white font-medium truncate max-w-lg">{h.query}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={h.success ? "text-green-400" : "text-red-400"}>
                            {(h.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="text-slate-500">{Math.round(h.latency_ms)}ms</span>
                          <span className="text-slate-600">Tier {h.tier}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{h.response}</p>
                      {h.tools.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {h.tools.map((t, j) => (
                            <span key={j} className="px-1.5 py-0.5 text-[9px] rounded bg-white/[0.05] text-slate-400">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
