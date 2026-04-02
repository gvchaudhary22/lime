"use client";

import { useState } from "react";
import {
  Play, Loader2, CheckCircle2, SkipForward, Zap,
  Search, GitBranch, Database, Brain,
} from "lucide-react";

interface WaveResult {
  name: string;
  icon: React.ElementType;
  status: "done" | "skipped";
  latency_ms: number;
  summary: string;
}

const mockResult: WaveResult[] = [
  {
    name: "Wave 1: Probe",
    icon: Search,
    status: "done",
    latency_ms: 45,
    summary: "Initial semantic search retrieved 12 candidate chunks from embeddings. Top match scored 0.91 similarity for order-related documents.",
  },
  {
    name: "Wave 2: Deep GraphRAG",
    icon: GitBranch,
    status: "done",
    latency_ms: 120,
    summary: "Graph traversal expanded context through 3 entity hubs: Order, Shipment, Courier. Added 8 related chunks via PPR walk (alpha=0.15).",
  },
  {
    name: "Wave 3: LangGraph",
    icon: Zap,
    status: "done",
    latency_ms: 85,
    summary: "Multi-hop reasoning chain resolved order -> shipment -> courier mapping. Identified cancel_shipment action as most relevant.",
  },
  {
    name: "Wave 4: Neo4j",
    icon: Database,
    status: "skipped",
    latency_ms: 0,
    summary: "Skipped — Wave 2 GraphRAG confidence (0.89) exceeded threshold. Neo4j fallback not required.",
  },
  {
    name: "Wave 5: RIPER+ReAct",
    icon: Brain,
    status: "done",
    latency_ms: 210,
    summary: "ReAct loop executed 2 tool calls: order_lookup(12345) -> get_shipment_details(SH-9876). Final response synthesized with 0.92 confidence.",
  },
];

export default function SimulationPage() {
  const [query, setQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<WaveResult[] | null>(null);

  const handleRun = () => {
    if (!query.trim()) return;
    setIsRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult(mockResult);
      setIsRunning(false);
    }, 1500);
  };

  const totalLatency = result?.reduce((acc, w) => acc + w.latency_ms, 0) ?? 0;
  const overallConfidence = 0.92;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Query Input */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
        <label className="text-sm font-medium text-slate-300 mb-2 block">Simulation Query</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a query to simulate... e.g. 'How do I cancel order #12345?'"
          className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 resize-none h-24 focus:outline-none focus:border-purple-500/40 transition-colors"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleRun}
            disabled={isRunning || !query.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Simulation
          </button>
        </div>
      </div>

      {/* Loading */}
      {isRunning && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Running 5-wave simulation...</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Wave Execution</h3>

          {result.map((wave, idx) => (
            <div
              key={idx}
              className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    wave.status === "done" ? "bg-green-500/10" : "bg-slate-500/10"
                  }`}>
                    <wave.icon className={`w-4 h-4 ${wave.status === "done" ? "text-green-400" : "text-slate-500"}`} />
                  </div>
                  <span className="text-sm font-medium text-white">{wave.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {wave.latency_ms > 0 && (
                    <span className="text-xs text-slate-500 font-mono">{wave.latency_ms}ms</span>
                  )}
                  {wave.status === "done" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
                      <SkipForward className="w-3 h-3" /> Skipped
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{wave.summary}</p>
            </div>
          ))}

          {/* Overall Confidence */}
          <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Overall Confidence</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500 font-mono">Total: {totalLatency}ms</span>
                <span className="text-sm font-bold text-green-400">{(overallConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="w-full h-2.5 bg-[#0a0e1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${overallConfidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
