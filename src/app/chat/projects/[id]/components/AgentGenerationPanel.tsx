"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface AgentGenerationPanelProps {
  repoId: string;
  onAgentsGenerated?: () => void;
}

interface PlanData {
  tier: string;
  framework: string;
  archetype: string;
  agents: { name: string; file: string; action: string; reason?: string }[];
  skills: { name: string; file: string; action: string; source?: string; reason?: string }[];
  rules: { name: string; file: string; action: string }[];
  hooks?: { name: string; action: string };
  summary: string;
  estimated_files: number;
  default_budget_usd: number;
}

interface ScoreItem {
  criteria: string;
  score: number;
  max: number;
  notes: string;
}

type PanelState = "loading" | "not_ready" | "ready" | "plan_created" | "approved" | "executing" | "completed";

export default function AgentGenerationPanel({ repoId, onAgentsGenerated }: AgentGenerationPanelProps) {
  const [state, setState] = useState<PanelState>("loading");
  const [readiness, setReadiness] = useState<{ ready: boolean; context_score: number; module_count: number; gaps: string[] } | null>(null);
  const [plan, setPlan] = useState<{ id: string; status: string; plan_data: string } | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastHistory, setLastHistory] = useState<{ files_created: number; status: string; summary?: string } | null>(null);

  // Scoring
  const [showScores, setShowScores] = useState(false);
  const [aiScores, setClaudeScores] = useState<ScoreItem[]>([]);
  const [marsScores, setMarsScores] = useState<ScoreItem[]>([]);
  const [aiTotal, setClaudeTotal] = useState(0);
  const [aiMax, setClaudeMax] = useState(0);
  const [marsTotal, setMarsTotal] = useState(0);
  const [marsMax, setMarsMax] = useState(0);
  const [scoringLoading, setScoringLoading] = useState(false);

  useEffect(() => {
    checkState();
  }, [repoId]);

  const checkState = async () => {
    setState("loading");

    // First check if agent generation already completed
    try {
      const histRes = await api.getAgentHistory(repoId);
      if (histRes.success && histRes.data && histRes.data.length > 0) {
        const latest = histRes.data[0];
        if (latest.status === "completed") {
          setLastHistory({ files_created: latest.files_created, status: latest.status, summary: planData?.summary });
          setState("completed");
          return;
        }
      }
    } catch { /* no history — continue to readiness check */ }

    // Check readiness
    const res = await api.checkAgentReadiness(repoId);
    if (res.success && res.data) {
      setReadiness(res.data);
      setState(res.data.ready ? "ready" : "not_ready");
    } else {
      setState("not_ready");
    }
  };

  const generatePlan = async () => {
    setError(null);
    const res = await api.generateAgentPlan(repoId);
    if (res.success && res.data) {
      setPlan(res.data);
      try {
        setPlanData(JSON.parse(res.data.plan_data));
      } catch {
        setPlanData(null);
      }
      setState("plan_created");
    } else {
      setError(res.error || "Failed to generate plan");
    }
  };

  const executePlan = async () => {
    if (!plan) return;
    setState("executing");
    setProgress([]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/repositories/${repoId}/agents/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify({ plan_id: plan.id }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.step && event.status) {
                setProgress((prev) => [...prev, `${event.step}: ${event.name || event.detail || event.status}`]);
              }
            } catch { /* ignore parse errors */ }
          }
          if (line.startsWith("event: done")) {
            setState("completed");
            onAgentsGenerated?.();
          }
        }
      }
    } catch (err) {
      setError("Execution failed");
      setState("plan_created");
    }
  };

  const runScoring = async () => {
    setScoringLoading(true);
    setShowScores(true);

    try {
      const res = await api.getRepoScores(repoId);
      if (res.success && res.data) {
        setClaudeScores(res.data.claude_breakdown || []);
        setMarsScores(res.data.mars_breakdown || []);
        setClaudeTotal(res.data.claude_score);
        setClaudeMax(res.data.claude_max);
        setMarsTotal(res.data.mars_score);
        setMarsMax(res.data.mars_max);
      } else {
        setError("Failed to fetch scores");
      }
    } catch {
      setError("Scoring request failed");
    } finally {
      setScoringLoading(false);
    }
  };

  // ─── Loading ───
  if (state === "loading") {
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
        <div className="text-sm text-slate-400">Checking agent generation status...</div>
      </div>
    );
  }

  // ─── Not Ready ───
  if (state === "not_ready" && readiness) {
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-amber-700/30 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-400 text-sm font-medium">Agent Team Generation</span>
          <span className="text-xs px-2 py-0.5 bg-amber-900/30 text-amber-300 rounded">Not Ready</span>
        </div>
        <div className="text-sm text-slate-400 mb-2">
          Context score: {readiness.context_score}/100 (need 40+)
        </div>
        {readiness.gaps.length > 0 && (
          <ul className="text-xs text-slate-500 space-y-1">
            {readiness.gaps.map((gap, i) => (
              <li key={i}>• {gap}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ─── Ready (not yet generated) ───
  if (state === "ready") {
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-green-700/30 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm font-medium">Agent Team Generation</span>
            <span className="text-xs px-2 py-0.5 bg-green-900/30 text-green-300 rounded">Ready</span>
          </div>
          <span className="text-xs text-slate-500">Score: {readiness?.context_score}/100</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Generate agents, skills, rules, and hooks tailored for this repository.
          Plan requires admin approval before execution.
        </p>
        <button
          onClick={generatePlan}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
        >
          Generate Agent Team Plan
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  // ─── Plan Created / Approved ───
  if ((state === "plan_created" || state === "approved") && planData) {
    const createAgents = planData.agents.filter((a) => a.action === "create");
    const createSkills = planData.skills.filter((s) => s.action === "create");

    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-blue-700/30 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-sm font-medium">Agent Generation Plan</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              plan?.status === "approved" ? "bg-green-900/30 text-green-300" : "bg-yellow-900/30 text-yellow-300"
            }`}>
              {plan?.status === "approved" ? "Approved" : "Pending Admin Approval"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-slate-900/50 p-2 rounded">
            <span className="text-slate-500">Tier:</span> <span className="text-slate-300">{planData.tier}</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded">
            <span className="text-slate-500">Framework:</span> <span className="text-slate-300">{planData.framework}</span>
          </div>
        </div>

        <div className="text-xs text-slate-400 mb-2">
          <strong>{createAgents.length} agents</strong>: {createAgents.map((a) => a.name).join(", ")}
        </div>
        <div className="text-xs text-slate-400 mb-3">
          <strong>{createSkills.length} skills</strong>, <strong>{planData.rules.length} rules</strong>
        </div>

        {plan?.status === "approved" && (
          <button
            onClick={executePlan}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md transition-colors"
          >
            Execute Generation
          </button>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  // ─── Executing ───
  if (state === "executing") {
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-blue-700/30 mb-4">
        <div className="text-blue-400 text-sm font-medium mb-2">Generating Agent Team...</div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {progress.map((p, i) => (
            <div key={i} className="text-xs text-slate-400">{p}</div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Completed + Scoring ───
  if (state === "completed") {
    return (
      <div className="space-y-3 mb-4">
        {/* Completion Banner */}
        <div className="p-4 rounded-lg bg-slate-800/50 border border-green-700/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-400 text-sm font-medium mb-1">✓ Agent Team Generated</div>
              <div className="text-xs text-slate-400">
                {lastHistory?.files_created ? `${lastHistory.files_created} files created` : "Agents, skills, rules, and hooks deployed"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`/chat/admin/agent-structure/${repoId}`, "_blank")}
                className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs rounded-md transition-colors"
              >
                View Structure
              </button>
              {!showScores && (
                <button
                  onClick={runScoring}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
                >
                  Check Scores
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scoring Panel */}
        {scoringLoading && (
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
            <div className="text-sm text-slate-400">Calculating scores...</div>
          </div>
        )}

        {showScores && !scoringLoading && (
          <div className="space-y-3">
            {/* Score Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-900/30 to-slate-800/50 border border-purple-500/20 text-center">
                <div className="text-3xl font-bold text-purple-300">{aiTotal}<span className="text-lg text-purple-500">/{aiMax || 120}</span></div>
                <div className="text-xs text-purple-400 mt-1">AI Perspective</div>
                <div className="text-[10px] text-slate-500">How well AI can work here</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-900/30 to-slate-800/50 border border-blue-500/20 text-center">
                <div className="text-3xl font-bold text-blue-300">{marsTotal}<span className="text-lg text-blue-500">/{marsMax || 100}</span></div>
                <div className="text-xs text-blue-400 mt-1">MARS Perspective</div>
                <div className="text-[10px] text-slate-500">How well MARS can orchestrate</div>
              </div>
            </div>

            {/* AI Score Breakdown */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-purple-700/20">
              <div className="text-purple-400 text-sm font-medium mb-3">AI Perspective — {aiTotal}/120</div>
              <div className="space-y-1.5">
                {aiScores.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-48 text-slate-400 truncate">{s.criteria}</div>
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.score >= s.max * 0.8 ? "bg-green-500" : s.score >= s.max * 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${(s.score / s.max) * 100}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-slate-300">{s.score}/{s.max}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* MARS Score Breakdown */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-blue-700/20">
              <div className="text-blue-400 text-sm font-medium mb-3">MARS Perspective — {marsTotal}/100</div>
              <div className="space-y-1.5">
                {marsScores.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-48 text-slate-400 truncate">{s.criteria}</div>
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.score >= s.max * 0.8 ? "bg-green-500" : s.score >= s.max * 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${(s.score / s.max) * 100}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-slate-300">{s.score}/{s.max}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-amber-700/20">
              <div className="text-amber-400 text-sm font-medium mb-2">How to Improve</div>
              <ul className="text-xs text-slate-400 space-y-1.5">
                {aiScores.filter(s => s.score < s.max * 0.8).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">→</span>
                    <span><strong className="text-slate-300">{s.criteria}</strong> ({s.score}/{s.max}): {s.notes}</span>
                  </li>
                ))}
                {marsScores.filter(s => s.score < s.max * 0.8).map((s, i) => (
                  <li key={`m${i}`} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">→</span>
                    <span><strong className="text-slate-300">{s.criteria}</strong> ({s.score}/{s.max}): {s.notes}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Re-generate option */}
            <div className="text-center">
              <button
                onClick={() => { setShowScores(false); setState("ready"); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Re-generate Agent Team
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
