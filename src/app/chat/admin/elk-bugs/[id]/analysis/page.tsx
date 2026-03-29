"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Loader2,
  GitPullRequest,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Database,
  Lightbulb,
  Zap,
  Copy,
  ExternalLink,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import { api } from "@/lib/api";
import type { ELKBug } from "@/lib/api";

interface AnalysisResult {
  root_cause: string;
  why_it_happens: string;
  affected_areas: string[];
  fix_approach: string;
  code_changes: { file: string; description: string; }[];
  db_impact: string;
  risk_level: string;
  estimated_effort: string;
  prevention: string;
  rca_summary: string;
  fix_detailed_steps: string;
}

export default function ELKBugAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const bugId = params.id as string;

  const [bug, setBug] = useState<ELKBug | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingPR, setGeneratingPR] = useState(false);
  const [prResult, setPrResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"issue" | "fix" | "rca">("issue");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    loadBug();
  }, [bugId]);

  const loadBug = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getELKBug(bugId);
      if (res.success && res.data) {
        setBug(res.data);
        // Check if analysis already exists in DB
        if (res.data.ai_analysis && res.data.analysis_status === "completed") {
          try {
            let parsed = JSON.parse(res.data.ai_analysis);
            // Handle wrapped format: {"raw_analysis": "```json\n{...}\n```"}
            if (parsed.raw_analysis && !parsed.root_cause) {
              const raw = parsed.raw_analysis;
              // Extract JSON from markdown code blocks
              const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const inner = jsonMatch[1] || jsonMatch[0];
                try { parsed = JSON.parse(inner); } catch { /* keep wrapped */ }
              }
            }
            setAnalysis(parsed);
            setRawAnalysis(res.data.ai_analysis);
          } catch {
            setRawAnalysis(res.data.ai_analysis);
          }
        }
        // Don't auto-trigger analysis — let user click the button
        setLoading(false);
      } else {
        setError("Bug not found");
        setLoading(false);
      }
    } catch {
      setError("Failed to load bug");
      setLoading(false);
    }
  }, [bugId]);

  const runAnalysis = async (bugData: ELKBug) => {
    setAnalyzing(true);
    setLoading(false);
    try {
      const res = await api.analyzeELKBug(bugData.id);
      if (res.success && res.data) {
        setRawAnalysis(res.data.analysis || "");
        try {
          let parsed = JSON.parse(res.data.analysis);
          if (parsed.raw_analysis && !parsed.root_cause) {
            const raw = parsed.raw_analysis;
            const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try { parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]); } catch { /* keep wrapped */ }
            }
          }
          setAnalysis(parsed);
        } catch {
          setAnalysis(null);
        }
      } else {
        setError("Analysis failed");
      }
    } catch {
      setError("Analysis request failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const generatePR = async () => {
    if (!bug) return;
    setGeneratingPR(true);
    setPrResult(null);
    try {
      const res = await api.generateELKBugFix(bug.id);
      if (res.success && res.data?.pr_url) {
        setPrResult(res.data.pr_url);
        await api.updateELKBug(bug.id, { status: "pr_generated", pr_url: res.data.pr_url });
        setBug(prev => prev ? { ...prev, status: "pr_generated", pr_url: res.data.pr_url } : prev);
      } else {
        setPrResult("PR generation attempted but no PR URL returned. Marsbuilder may not be deployed.");
      }
    } catch {
      setError("PR generation failed");
    } finally {
      setGeneratingPR(false);
    }
  };

  const riskColors: Record<string, string> = {
    low: "text-green-400 bg-green-500/20 border-green-500/30",
    medium: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30",
    high: "text-red-400 bg-red-500/20 border-red-500/30",
    critical: "text-red-500 bg-red-600/20 border-red-600/30",
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button + Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/chat/admin/elk-bugs")}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Bugs
            </button>
          </div>

          {/* Bug Info Card */}
          {bug && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-white">{bug.error_message}</h1>
                  {bug.error_type && bug.error_type !== bug.error_message && (
                    <p className="text-sm text-zinc-400 mt-1">{bug.error_type}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                    <span>Occurrences: <span className="text-orange-300 font-mono">{bug.occurrence_count}x</span></span>
                    {bug.source_file && (
                      <span>Source: <span className="text-zinc-300 font-mono">{bug.source_file}{bug.source_line > 0 ? `:${bug.source_line}` : ""}</span></span>
                    )}
                    <span>Index: <span className="text-zinc-400 font-mono">{bug.index_pattern}</span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {(loading || analyzing) && (
            <div className="bg-zinc-900/60 border border-purple-500/20 rounded-lg p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
              <p className="text-purple-300 font-medium">
                {loading ? "Loading bug details..." : "AI is analyzing the error..."}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Examining source code, error patterns, and module knowledge
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Run Analysis Button (when no analysis exists) */}
          {!analysis && !rawAnalysis && !analyzing && !loading && bug && (
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-lg p-6 text-center">
              <Brain className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">No Analysis Yet</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Click below to run AI-powered root cause analysis on this error.
              </p>
              <button
                onClick={() => runAnalysis(bug)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2 mx-auto"
              >
                <Brain className="w-4 h-4" />
                Run Analysis
              </button>
            </div>
          )}

          {/* Tabs */}
          {(analysis || rawAnalysis) && !analyzing && (
            <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
              {[
                { key: "issue" as const, label: "Issue Analysis", icon: "Brain" },
                { key: "fix" as const, label: "How to Fix", icon: "Zap" },
                { key: "rca" as const, label: "Root Cause Analysis", icon: "AlertTriangle" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* TAB 1: Issue Analysis */}
          {analysis && !analyzing && activeTab === "issue" && (
            <div className="space-y-4">
              {/* Root Cause */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Root Cause</h2>
                  {analysis.risk_level && (
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${riskColors[analysis.risk_level.toLowerCase()] || riskColors.medium}`}>
                      {analysis.risk_level} risk
                    </span>
                  )}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{analysis.root_cause}</p>
              </div>

              {/* Why It Happens */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <h2 className="text-lg font-semibold text-white">Why This Happens</h2>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{analysis.why_it_happens}</p>
              </div>

              {/* Affected Areas */}
              {analysis.affected_areas?.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Affected Areas</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.affected_areas.map((area, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded-full">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fix Approach */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-green-400" />
                  <h2 className="text-lg font-semibold text-white">How to Fix</h2>
                  {analysis.estimated_effort && (
                    <span className="text-xs text-zinc-500">Effort: {analysis.estimated_effort}</span>
                  )}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{analysis.fix_approach}</p>
              </div>

              {/* Code Changes */}
              {analysis.code_changes?.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">Required Code Changes</h2>
                  </div>
                  <div className="space-y-2">
                    {analysis.code_changes.map((change, i) => (
                      <div key={i} className="flex items-start gap-3 bg-black/30 rounded p-3">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-cyan-300 font-mono text-xs">{change.file}</span>
                          <p className="text-zinc-400 text-xs mt-0.5">{change.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DB Impact */}
              {analysis.db_impact && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Database Impact</h2>
                  </div>
                  <p className="text-zinc-300 text-sm">{analysis.db_impact}</p>
                </div>
              )}

              {/* Prevention */}
              {analysis.prevention && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <h2 className="text-lg font-semibold text-white">Prevention</h2>
                  </div>
                  <p className="text-zinc-300 text-sm">{analysis.prevention}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: How to Fix */}
          {(analysis || rawAnalysis) && !analyzing && activeTab === "fix" && (
            <div className="space-y-4">
              {analysis?.fix_approach && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-green-400" />
                    <h2 className="text-lg font-semibold text-white">Fix Approach</h2>
                    {analysis.estimated_effort && <span className="text-xs text-zinc-500">Effort: {analysis.estimated_effort}</span>}
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis.fix_approach}</p>
                </div>
              )}
              {analysis?.code_changes && analysis.code_changes.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">Required Code Changes</h2>
                  </div>
                  <div className="space-y-2">
                    {analysis.code_changes.map((change, i) => (
                      <div key={i} className="flex items-start gap-3 bg-black/30 rounded p-3">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-cyan-300 font-mono text-xs">{change.file}</span>
                          <p className="text-zinc-400 text-xs mt-0.5">{change.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis?.fix_detailed_steps && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Detailed Implementation Steps</h2>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis.fix_detailed_steps}</p>
                </div>
              )}
              {analysis?.db_impact && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Database Impact</h2>
                  </div>
                  <p className="text-zinc-300 text-sm">{analysis.db_impact}</p>
                </div>
              )}
              {analysis?.prevention && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <h2 className="text-lg font-semibold text-white">Prevention</h2>
                  </div>
                  <p className="text-zinc-300 text-sm">{analysis.prevention}</p>
                </div>
              )}
              {/* Fallback for raw analysis */}
              {!analysis && rawAnalysis && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={rawAnalysis} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Root Cause Analysis */}
          {(analysis || rawAnalysis) && !analyzing && activeTab === "rca" && (
            <div className="space-y-4">
              {analysis?.rca_summary && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h2 className="text-lg font-semibold text-white">Root Cause Analysis</h2>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis.rca_summary}</p>
                </div>
              )}
              {analysis?.root_cause && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <h2 className="text-lg font-semibold text-white">Root Cause (Summary)</h2>
                    {analysis.risk_level && (
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${riskColors[analysis.risk_level.toLowerCase()] || riskColors.medium}`}>
                        {analysis.risk_level} risk
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-300 text-sm">{analysis.root_cause}</p>
                </div>
              )}
              {analysis?.why_it_happens && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <h2 className="text-lg font-semibold text-white">Why This Happens</h2>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed">{analysis.why_it_happens}</p>
                </div>
              )}
              {analysis?.affected_areas && analysis.affected_areas.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Affected Areas</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.affected_areas.map((area, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded-full">{area}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Fallback for raw analysis */}
              {!analysis && rawAnalysis && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={rawAnalysis} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate PR Button */}
          {(analysis || rawAnalysis) && !analyzing && !generatingPR && !prResult && !bug?.pr_url && bug?.status !== "pr_generated" && bug?.status !== "pr_merged" && bug?.status !== "resolved" && (
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-lg p-6 text-center">
              <GitPullRequest className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Ready to Generate Fix</h3>
              <p className="text-sm text-zinc-400 mb-4">
                MARS will create a branch, implement the fix based on the analysis above, run tests, and create a PR.
              </p>
              <button
                onClick={generatePR}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2 mx-auto"
              >
                <GitPullRequest className="w-4 h-4" />
                Generate PR
              </button>
            </div>
          )}

          {/* PR Generation In Progress */}
          {generatingPR && (
            <div className="bg-zinc-900/60 border border-blue-500/20 rounded-lg p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
              <p className="text-blue-300 font-medium">Generating fix PR...</p>
              <p className="text-xs text-zinc-500 mt-1">
                Creating branch, writing code, running tests, pushing PR
              </p>
            </div>
          )}

          {/* PR Result — from current session or loaded from DB */}
          {(prResult || bug?.pr_url) && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-300 mb-2">PR Generated!</h3>
              {(() => {
                const url = prResult || bug?.pr_url || "";
                return url.startsWith("http") ? (
                  <div className="space-y-3">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg border border-green-500/30 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View PR on GitHub
                    </a>
                    {bug?.pr_branch && <p className="text-xs text-zinc-500">Branch: {bug.pr_branch}</p>}
                    {bug?.review_status === "pending_review" && (
                      <p className="text-xs text-orange-300 mt-1">Pending manager review</p>
                    )}
                    {bug?.review_status === "approved" && (
                      <p className="text-xs text-green-300 mt-1">Approved by manager</p>
                    )}
                    {bug?.review_status === "rejected" && (
                      <p className="text-xs text-red-300 mt-1">Rejected by manager: {bug.review_comment}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">{url}</p>
                );
              })()}
            </div>
          )}

          {/* Re-analyze Button */}
          {!analyzing && (analysis || rawAnalysis) && (
            <div className="text-center">
              <button
                onClick={() => bug && runAnalysis(bug)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                Re-run analysis
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
