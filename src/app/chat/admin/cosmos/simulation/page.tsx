"use client";

import { useState, useCallback } from "react";
import {
  Play, Loader2, CheckCircle2, SkipForward, XCircle,
  Search, GitBranch, Zap, Database, Brain,
  ChevronDown, ChevronRight, History, AlertTriangle,
  Wrench, FileText, Lightbulb, ArrowRight, X,
  ThumbsUp, ThumbsDown, Copy, Check,
  SlidersHorizontal, MessageSquare,
} from "lucide-react";
import {
  api,
  SimulationResult, SimWaveResult,
  DiagnosisResult, DiagnosticRecommendation, FixAction,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  query: string;
  confidence: number;
  latency_ms: number;
  timestamp: string;
  result: SimulationResult;
}

const WAVE_ICONS = [Search, GitBranch, Zap, Database, Brain];

const confidenceColor = (c: number) =>
  c >= 0.8 ? "text-green-400" : c >= 0.5 ? "text-yellow-400" : "text-red-400";

const confidenceBg = (c: number) =>
  c >= 0.8 ? "bg-green-500" : c >= 0.5 ? "bg-yellow-500" : "bg-red-500";

const categoryColors: Record<string, string> = {
  kb_missing:               "bg-red-500/15 text-red-400 border-red-500/30",
  embedding_poor:           "bg-orange-500/15 text-orange-400 border-orange-500/30",
  threshold_misconfigured:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  technique_failure:        "bg-purple-500/15 text-purple-400 border-purple-500/30",
  correct:                  "bg-green-500/15 text-green-400 border-green-500/30",
  partial:                  "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const priorityDot: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-yellow-400",
  low:    "bg-slate-400",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [query, setQuery]                   = useState("");
  const [mode, setMode]                     = useState<"lookup" | "diagnose" | "act" | "explain">("act");
  const [showOverrides, setShowOverrides]   = useState(false);
  const [waveThreshold, setWaveThreshold]   = useState(0.85);
  const [topK, setTopK]                     = useState(20);
  const [isRunning, setIsRunning]           = useState(false);
  const [result, setResult]                 = useState<SimulationResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [expandedWaves, setExpandedWaves]   = useState<Record<number, boolean>>({});
  const [showRaw, setShowRaw]               = useState<Record<number, boolean>>({});
  // Diagnosis
  const [diagnosing, setDiagnosing]         = useState(false);
  const [diagnosis, setDiagnosis]           = useState<DiagnosisResult | null>(null);
  // Correct-answer modal
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [expectedAnswer, setExpectedAnswer]  = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone]      = useState(false);
  // Copy
  const [copied, setCopied]                  = useState(false);
  // Session history
  const [history, setHistory]                = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory]        = useState(false);

  const ssoCompanyId = (): string => {
    if (typeof window === "undefined") return "";
    try {
      const raw = localStorage.getItem("mars_sso_context");
      return raw ? (JSON.parse(raw) as { company_id?: string }).company_id || "" : "";
    } catch { return ""; }
  };

  const handleRun = useCallback(async () => {
    if (!query.trim()) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    setDiagnosis(null);
    setExpandedWaves({});
    setFeedbackDone(false);

    const res = await api.runSimulation({
      message: query,
      company_id: ssoCompanyId(),
      mode,
      overrides: { wave_threshold: waveThreshold, top_k: topK },
    });

    if (res.success && res.data) {
      const data = res.data;
      setResult(data);
      setHistory(prev => [{
        query,
        confidence: data.confidence,
        latency_ms: data.total_latency_ms,
        timestamp: data.timestamp,
        result: data,
      }, ...prev].slice(0, 20));
    } else {
      setError(res.error || "Simulation failed — check MARS/COSMOS connection");
    }
    setIsRunning(false);
  }, [query, mode, waveThreshold, topK]);

  const handleDiagnose = useCallback(async () => {
    if (!result) return;
    setDiagnosing(true);
    const res = await api.diagnoseQuery({
      query,
      wave_trace: result.waves,
      final_response: result.final_response,
    });
    if (res.success && res.data) setDiagnosis(res.data);
    setDiagnosing(false);
  }, [result, query]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!result || !expectedAnswer.trim()) return;
    setSubmittingFeedback(true);
    await api.submitTrainingFeedback({
      query,
      actual_response: result.final_response,
      expected_response: expectedAnswer,
      root_cause_category: diagnosis?.category,
    });
    setSubmittingFeedback(false);
    setFeedbackDone(true);
    setShowCorrectModal(false);
    setExpectedAnswer("");
  }, [result, query, expectedAnswer, diagnosis]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.final_response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const toggleWave = (i: number) =>
    setExpandedWaves(prev => ({ ...prev, [i]: !prev[i] }));

  const toggleRaw = (i: number) =>
    setShowRaw(prev => ({ ...prev, [i]: !prev[i] }));

  const waveStatusStyle = (status: SimWaveResult["status"]) => {
    if (status === "done")    return { icon: CheckCircle2,  iconCls: "text-green-400", bg: "bg-green-500/10",  badge: "text-green-400 bg-green-500/10 border-green-500/20" };
    if (status === "skipped") return { icon: SkipForward,   iconCls: "text-slate-500", bg: "bg-slate-500/10",  badge: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
    if (status === "error")   return { icon: XCircle,       iconCls: "text-red-400",   bg: "bg-red-500/10",    badge: "text-red-400 bg-red-500/10 border-red-500/20" };
    if (status === "running") return { icon: Loader2,       iconCls: "text-blue-400",  bg: "bg-blue-500/10",   badge: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    return                           { icon: SkipForward,   iconCls: "text-slate-600", bg: "bg-slate-700/10",  badge: "text-slate-600 bg-slate-700/10 border-slate-700/20" };
  };

  return (
    <div className="flex gap-4 max-w-7xl relative">
      {/* ── Left Panel ── */}
      <div className="w-[400px] shrink-0 space-y-4">

        {/* Query Input */}
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <label className="text-sm font-medium text-slate-300 mb-3 block">Simulation Query</label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleRun(); }}
            placeholder="e.g. How do I cancel order #12345?"
            className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 resize-none h-28 focus:outline-none focus:border-purple-500/40 transition-colors"
          />

          {/* Mode pills */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {(["act", "lookup", "diagnose", "explain"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  mode === m
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-white/[0.03] border-white/[0.08] text-slate-500 hover:text-slate-300"
                }`}>{m}</button>
            ))}
          </div>

          {/* Overrides toggle */}
          <button onClick={() => setShowOverrides(v => !v)}
            className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showOverrides ? "Hide" : "Show"} overrides
          </button>

          {showOverrides && (
            <div className="mt-3 grid grid-cols-2 gap-3 p-3 bg-[#0a0e1a] rounded-lg border border-white/[0.05]">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Wave threshold</label>
                <input type="number" min={0} max={1} step={0.05} value={waveThreshold}
                  onChange={e => setWaveThreshold(+e.target.value)}
                  className="w-full bg-transparent border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Top-K chunks</label>
                <input type="number" min={5} max={50} step={5} value={topK}
                  onChange={e => setTopK(+e.target.value)}
                  className="w-full bg-transparent border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none" />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={handleRun} disabled={isRunning || !query.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Simulation
            </button>
            <button onClick={() => setShowHistory(v => !v)}
              className="p-2.5 border border-white/[0.08] rounded-lg text-slate-400 hover:text-white hover:border-white/[0.15] transition-all">
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Diagnosis Panel */}
        {diagnosis && (
          <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" /> MARS Diagnosis
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColors[diagnosis.category] || ""}`}>
                {diagnosis.category.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{diagnosis.root_cause}</p>

            {diagnosis.failed_wave && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                Weakest link: <span className="text-yellow-400 font-medium">Wave {diagnosis.failed_wave}</span>
                <span className="ml-auto text-slate-600">confidence gap: {(diagnosis.confidence_gap * 100).toFixed(0)}%</span>
              </div>
            )}

            {/* KB / Embedding scores */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "KB Coverage", val: diagnosis.kb_coverage_score },
                { label: "Embedding Quality", val: diagnosis.embedding_quality_score },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">{label}</span>
                    <span className={confidenceColor(val)}>{(val * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#0a0e1a] rounded-full">
                    <div className={`h-full rounded-full ${confidenceBg(val)}`} style={{ width: `${val * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {diagnosis.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Recommendations</p>
                {diagnosis.recommendations.map((r: DiagnosticRecommendation, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[r.priority]}`} />
                    <div>
                      <span className="text-xs text-white">{r.description}</span>
                      <span className="ml-2 text-xs text-slate-600 capitalize">{r.area}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fix Actions */}
            {diagnosis.fix_actions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fix Actions</p>
                {diagnosis.fix_actions.map((f: FixAction, i: number) => (
                  <div key={i} className="bg-[#0a0e1a] rounded-lg p-2.5 flex items-start gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-slate-300 font-mono">{f.action}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{f.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons after result */}
        {result && (
          <div className="flex gap-2">
            <button onClick={handleDiagnose} disabled={diagnosing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111830] border border-white/[0.06] hover:border-purple-500/30 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50">
              {diagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 text-purple-400" />}
              Run MARS Analysis
            </button>
            <button onClick={() => setShowCorrectModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111830] border border-white/[0.06] hover:border-blue-500/30 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              {feedbackDone ? "Feedback sent ✓" : "Correct Answer"}
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {isRunning && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <span className="ml-3 text-sm text-slate-400">Running 5-wave simulation...</span>
          </div>
        )}

        {result && !isRunning && (
          <>
            {/* Wave Execution */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wave Execution</h3>
              {result.waves.map((wave, idx) => {
                const style   = waveStatusStyle(wave.status);
                const Icon    = WAVE_ICONS[idx] || Brain;
                const StatusIcon = style.icon;
                const isExpanded = !!expandedWaves[idx];
                const hasData = wave.data && Object.keys(wave.data).length > 0;

                return (
                  <div key={idx} className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.1] transition-colors">
                    {/* Wave Header */}
                    <button onClick={() => toggleWave(idx)} className="w-full flex items-center justify-between p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg}`}>
                          <Icon className={`w-4 h-4 ${style.iconCls}`} />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white">{wave.name}</span>
                          {wave.summary && (
                            <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{wave.summary}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {(wave.latency_ms ?? 0) > 0 && (
                          <span className="text-xs text-slate-600 font-mono">{wave.latency_ms}ms</span>
                        )}
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${style.badge}`}>
                          <StatusIcon className={`w-3 h-3 ${wave.status === "running" ? "animate-spin" : ""}`} />
                          {wave.status}
                        </span>
                        {hasData && (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4 text-slate-500" />
                            : <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {/* Wave Body */}
                    {isExpanded && hasData && (
                      <div className="border-t border-white/[0.04] p-4 space-y-3">
                        {/* Chunks */}
                        {Array.isArray((wave.data as Record<string, unknown>)?.chunks) && (
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Retrieved Chunks</p>
                            <div className="space-y-1.5">
                              {((wave.data as Record<string, unknown>).chunks as Record<string, unknown>[]).slice(0, 5).map((c, ci) => (
                                <div key={ci} className="flex items-start gap-2 bg-[#0a0e1a] rounded-lg p-2.5">
                                  <span className="text-xs font-mono text-purple-400 shrink-0 mt-0.5">{String(c.pillar || "–")}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300 truncate">{String(c.content_preview || "")}</p>
                                    <span className="text-xs text-slate-600">score: {typeof c.score === "number" ? c.score.toFixed(3) : "–"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tool calls */}
                        {Array.isArray((wave.data as Record<string, unknown>)?.tool_calls) && (
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Tool Calls</p>
                            <div className="space-y-1.5">
                              {((wave.data as Record<string, unknown>).tool_calls as Record<string, unknown>[]).map((t, ti) => (
                                <div key={ti} className="bg-[#0a0e1a] rounded-lg p-2.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Wrench className="w-3 h-3 text-slate-500" />
                                    <span className="text-xs font-mono text-blue-400">{String(t.tool || "")}</span>
                                    {typeof t.latency_ms === "number" && (
                                      <span className="text-xs text-slate-600 ml-auto">{t.latency_ms}ms</span>
                                    )}
                                  </div>
                                  {t.result && <p className="text-xs text-slate-500 truncate">{String(t.result)}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Raw debug toggle */}
                        <button onClick={() => toggleRaw(idx)}
                          className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors">
                          {showRaw[idx] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          Raw debug
                        </button>
                        {showRaw[idx] && (
                          <pre className="bg-[#0a0e1a] rounded-lg p-3 text-xs text-slate-500 overflow-x-auto max-h-48">
                            {JSON.stringify(wave.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Confidence */}
            <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Overall Confidence</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-mono">
                    {result.total_latency_ms}ms total
                  </span>
                  <span className={`text-sm font-bold ${confidenceColor(result.confidence)}`}>
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-2.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${confidenceBg(result.confidence)}`}
                  style={{ width: `${result.confidence * 100}%` }} />
              </div>
              {/* Meta */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                {result.tools_used.length > 0 && (
                  <span>Tools: <span className="text-slate-300">{result.tools_used.join(", ")}</span></span>
                )}
                {result.pattern_hit && (
                  <span className="text-yellow-400">Pattern hit</span>
                )}
                {result.guardrails_pre > 0 && (
                  <span>Guards: <span className="text-slate-300">{result.guardrails_pre} pre / {result.guardrails_post} post</span></span>
                )}
              </div>
            </div>

            {/* Final Response */}
            <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" /> Final Response
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="p-1.5 rounded text-slate-500 hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <ThumbsUp className="w-3.5 h-3.5 text-slate-600 hover:text-green-400 cursor-pointer transition-colors" />
                  <ThumbsDown className="w-3.5 h-3.5 text-slate-600 hover:text-red-400 cursor-pointer transition-colors"
                    onClick={() => setShowCorrectModal(true)} />
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {result.final_response || "No response generated."}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── History Sidebar ── */}
      {showHistory && (
        <div className="w-72 shrink-0 bg-[#111830] border border-white/[0.06] rounded-xl p-4 space-y-3 overflow-y-auto max-h-[80vh]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session History</span>
            <button onClick={() => setShowHistory(false)}>
              <X className="w-4 h-4 text-slate-500 hover:text-white transition-colors" />
            </button>
          </div>
          {history.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">No runs yet</p>
          )}
          {history.map((h, i) => (
            <button key={i} onClick={() => { setResult(h.result); setQuery(h.query); setShowHistory(false); }}
              className="w-full text-left bg-[#0a0e1a] rounded-lg p-3 hover:border hover:border-purple-500/20 transition-all group">
              <p className="text-xs text-slate-300 truncate group-hover:text-white">{h.query}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-xs font-medium ${confidenceColor(h.confidence)}`}>
                  {(h.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-slate-600 font-mono">{h.latency_ms}ms</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Correct Answer Modal ── */}
      {showCorrectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111830] border border-white/[0.08] rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" /> Provide Correct Answer
              </h3>
              <button onClick={() => setShowCorrectModal(false)}>
                <X className="w-4 h-4 text-slate-500 hover:text-white transition-colors" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Query: <span className="text-slate-300 italic">{query}</span>
            </p>
            <textarea value={expectedAnswer} onChange={e => setExpectedAnswer(e.target.value)}
              placeholder="Enter the correct/expected answer..."
              className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 resize-none h-32 focus:outline-none focus:border-purple-500/40 transition-colors" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCorrectModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/[0.08] text-slate-400 text-sm rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmitFeedback} disabled={submittingFeedback || !expectedAnswer.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm rounded-lg transition-all disabled:opacity-50">
                {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Submit for Training
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

