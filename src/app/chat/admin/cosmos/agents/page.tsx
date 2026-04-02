"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot, Shield, Wrench, Loader2, RefreshCw, AlertTriangle,
  ChevronRight, ChevronDown, ArrowLeft, Zap, Database,
  FileCode, ArrowRightLeft,
} from "lucide-react";
import { api } from "@/lib/api";

const MARS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Tier = "CORE" | "SPECIALIZED" | "OPERATIONAL";

interface AgentSummary {
  name: string;
  domain: string;
  tier: Tier;
  tools_count: number;
  skills_count: number;
  actions_count: number;
  api_count: number;
}

interface EndpointInfo {
  method: string;
  path: string;
  controller: string;
  api_id: string;
}

interface ToolInfo {
  name: string;
  domain: string;
  read_write: string;
  risk_level: string;
  api_count: number;
  endpoints: EndpointInfo[];
}

interface SkillInfo {
  name: string;
  display_name: string;
  domain: string;
  api_count: number;
  triggers: string[];
  steps: Record<string, string>[];
  example_queries: string[];
}

interface ActionInfo {
  name: string;
  domain: string;
  properties: Record<string, unknown>;
}

interface AgentDetail {
  name: string;
  display_name: string;
  domain: string;
  tier: Tier;
  api_count: number;
  system_prompt: string;
  anti_patterns: string[];
  handoff_rules: Record<string, string>;
  tools: ToolInfo[];
  skills: SkillInfo[];
  actions: ActionInfo[];
}

const tierConfig: Record<Tier, { color: string; bg: string; border: string; label: string }> = {
  CORE: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Core" },
  SPECIALIZED: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Specialized" },
  OPERATIONAL: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Operational" },
};

const riskColor = (risk: string) => {
  if (risk === "low") return "text-green-400 bg-green-500/10";
  if (risk === "medium") return "text-yellow-400 bg-yellow-500/10";
  return "text-red-400 bg-red-500/10";
};

const rwBadge = (rw: string) => {
  if (rw === "READ") return "text-sky-400 bg-sky-500/10";
  if (rw === "WRITE") return "text-orange-400 bg-orange-500/10";
  return "text-slate-400 bg-slate-500/10";
};

async function marsRequest<T>(endpoint: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;
  const res = await fetch(`${MARS_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json();
  return json.data || json;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marsRequest<{ agents: AgentSummary[]; total: number }>(
        "/api/v1/admin/cosmos/registry/agents"
      );
      setAgents(data.agents || []);
    } catch {
      setError("Cannot connect to MARS");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (name: string) => {
    setDetailLoading(true);
    try {
      const data = await marsRequest<AgentDetail>(
        `/api/v1/admin/cosmos/registry/agents/${name}`
      );
      setDetail(data);
      setExpandedTools(new Set());
    } catch {
      setError("Failed to load agent detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const toggleTool = (name: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // --- DETAIL VIEW ---
  if (detail) {
    const cfg = tierConfig[detail.tier] || tierConfig.OPERATIONAL;
    return (
      <div className="space-y-6 max-w-6xl">
        {/* Back button */}
        <button
          onClick={() => setDetail(null)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to agents
        </button>

        {/* Agent Header */}
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                <Bot className={`w-6 h-6 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-mono">{detail.name}</h2>
                <p className="text-sm text-slate-400">{detail.domain}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-semibold uppercase ${cfg.color} ${cfg.bg} ${cfg.border} border px-2 py-1 rounded-full`}>
                {cfg.label}
              </span>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{detail.api_count.toLocaleString()}</div>
                <div className="text-xs text-slate-500">APIs mapped</div>
              </div>
            </div>
          </div>

          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-[#0a0e1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-sky-400">{detail.tools.length}</div>
              <div className="text-xs text-slate-500">Tools</div>
            </div>
            <div className="bg-[#0a0e1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-400">{detail.skills.length}</div>
              <div className="text-xs text-slate-500">Skills</div>
            </div>
            <div className="bg-[#0a0e1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-400">{detail.actions.length}</div>
              <div className="text-xs text-slate-500">Actions</div>
            </div>
          </div>

          {/* System Prompt */}
          {detail.system_prompt && (
            <div className="mt-4 p-3 bg-[#0a0e1a] rounded-lg border border-white/[0.04]">
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">System Prompt</p>
              <p className="text-xs text-slate-300 leading-relaxed">{detail.system_prompt}</p>
            </div>
          )}

          {/* Anti-patterns + Handoffs */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {detail.anti_patterns && detail.anti_patterns.length > 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                <p className="text-[10px] uppercase text-red-400 font-semibold mb-2">Anti-Patterns</p>
                {detail.anti_patterns.map((ap, i) => (
                  <p key={i} className="text-xs text-red-300/70 mb-1">• {ap}</p>
                ))}
              </div>
            )}
            {detail.handoff_rules && Object.keys(detail.handoff_rules).length > 0 && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <p className="text-[10px] uppercase text-blue-400 font-semibold mb-2">Handoff Rules</p>
                {Object.entries(detail.handoff_rules).map(([agent, reason]) => (
                  <p key={agent} className="text-xs text-blue-300/70 mb-1">
                    → <span className="font-mono text-blue-300">{agent}</span> <span className="text-slate-500">({reason})</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TOOLS */}
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-sky-400" />
            Tools ({detail.tools.length})
          </h3>
          <div className="space-y-2">
            {detail.tools.map((tool) => (
              <div key={tool.name} className="border border-white/[0.04] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleTool(tool.name)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedTools.has(tool.name) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-sm font-mono text-white">{tool.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${rwBadge(tool.read_write)}`}>
                      {tool.read_write || "?"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${riskColor(tool.risk_level)}`}>
                      {tool.risk_level || "?"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{tool.api_count} APIs</span>
                </button>

                {expandedTools.has(tool.name) && tool.endpoints.length > 0 && (
                  <div className="border-t border-white/[0.04] bg-[#0a0e1a] p-3 space-y-1.5">
                    {tool.endpoints.map((ep, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-semibold ${
                          ep.method === "GET" ? "text-green-400 bg-green-500/10" :
                          ep.method === "POST" ? "text-blue-400 bg-blue-500/10" :
                          ep.method === "PUT" ? "text-yellow-400 bg-yellow-500/10" :
                          ep.method === "DELETE" ? "text-red-400 bg-red-500/10" :
                          "text-slate-400 bg-slate-500/10"
                        }`}>
                          {ep.method || "?"}
                        </span>
                        <span className="text-slate-300 font-mono">{ep.path || ep.api_id}</span>
                        {ep.controller && (
                          <span className="text-slate-600 ml-auto">{ep.controller}</span>
                        )}
                      </div>
                    ))}
                    {tool.api_count > tool.endpoints.length && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        + {tool.api_count - tool.endpoints.length} more APIs
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {detail.tools.length === 0 && (
              <p className="text-sm text-slate-500">No tools linked to this agent</p>
            )}
          </div>
        </div>

        {/* SKILLS */}
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-purple-400" />
            Skills / Intents ({detail.skills.length})
          </h3>
          <div className="space-y-2">
            {detail.skills.map((skill) => (
              <div key={skill.name} className="p-3 bg-[#0a0e1a] rounded-lg border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-sm font-mono text-white">{skill.display_name || skill.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">{skill.api_count} APIs</span>
                </div>

                {/* Triggers */}
                {skill.triggers && skill.triggers.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-slate-500 uppercase">Triggers: </span>
                    <span className="text-xs text-purple-300/70">
                      {skill.triggers.slice(0, 5).map((t, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          &quot;{t}&quot;
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                {/* Steps */}
                {skill.steps && skill.steps.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {skill.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 w-4 text-right">{i + 1}.</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          step.type === "api_call" ? "text-sky-400 bg-sky-500/10" :
                          step.type === "respond" ? "text-green-400 bg-green-500/10" :
                          "text-slate-400 bg-slate-500/10"
                        }`}>
                          {step.type}
                        </span>
                        <span className="text-slate-400">{step.description || step.tool || ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Example queries */}
                {skill.example_queries && skill.example_queries.length > 0 && (
                  <div className="mt-1">
                    <span className="text-[10px] text-slate-500 uppercase">Examples: </span>
                    <span className="text-[10px] text-slate-400 italic">
                      {skill.example_queries.slice(0, 3).join(" · ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {detail.skills.length === 0 && (
              <p className="text-sm text-slate-500">No skills linked to this agent</p>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <FileCode className="w-4 h-4 text-orange-400" />
            Action Contracts ({detail.actions.length})
          </h3>
          <div className="space-y-2">
            {detail.actions.map((action) => (
              <div key={action.name} className="flex items-center justify-between p-3 bg-[#0a0e1a] rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-sm font-mono text-white">{action.name}</span>
                </div>
                <span className="text-xs text-slate-500">{action.domain}</span>
              </div>
            ))}
            {detail.actions.length === 0 && (
              <p className="text-sm text-slate-500">No action contracts for this domain</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        <span className="ml-2 text-sm text-slate-400">Loading agents from MARS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-300">{error}</p>
        <button onClick={fetchAgents} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Bot className="w-8 h-8 text-slate-500" />
        <p className="text-sm text-slate-400">No agents found. Run the training pipeline to populate agents from KB.</p>
        <button onClick={fetchAgents} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Agent Registry</h2>
          <p className="text-xs text-slate-500">{agents.length} agents from knowledge base (click to see details)</p>
        </div>
        <button
          onClick={fetchAgents}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/[0.1] text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tier Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(["CORE", "SPECIALIZED", "OPERATIONAL"] as Tier[]).map((tier) => {
          const cfg = tierConfig[tier];
          const tierAgents = agents.filter((a) => a.tier === tier);
          const count = tierAgents.length;
          const totalApis = tierAgents.reduce((s, a) => s + a.api_count, 0);
          return (
            <div key={tier} className="bg-[#111830] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-[10px] ${cfg.bg} ${cfg.border} border ${cfg.color} px-1.5 py-0.5 rounded-full`}>
                  {count} agents
                </span>
              </div>
              <div className={`text-2xl font-bold ${cfg.color}`}>{totalApis.toLocaleString()}</div>
              <div className="text-xs text-slate-500">total APIs mapped</div>
            </div>
          );
        })}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-3 gap-3">
        {agents.map((agent) => {
          const cfg = tierConfig[agent.tier] || tierConfig.OPERATIONAL;
          return (
            <button
              key={agent.name}
              onClick={() => fetchDetail(agent.name)}
              disabled={detailLoading}
              className="bg-[#111830] border border-white/[0.06] rounded-xl p-4 hover:border-purple-500/30 transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <Bot className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white font-mono">{agent.name}</h4>
                    <p className="text-[10px] text-slate-500">{agent.domain}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition-colors" />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3">
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                    <Wrench className="w-3 h-3" />
                    <span className="text-[10px]">Tools</span>
                  </div>
                  <span className="text-sm font-semibold text-sky-400">{agent.tools_count}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                    <Zap className="w-3 h-3" />
                    <span className="text-[10px]">Skills</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-400">{agent.skills_count}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                    <FileCode className="w-3 h-3" />
                    <span className="text-[10px]">Actions</span>
                  </div>
                  <span className="text-sm font-semibold text-orange-400">{agent.actions_count}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                    <Database className="w-3 h-3" />
                    <span className="text-[10px]">APIs</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{agent.api_count.toLocaleString()}</span>
                </div>
              </div>

              <span className={`inline-block mt-3 text-[10px] font-semibold uppercase ${cfg.color} ${cfg.bg} ${cfg.border} border px-1.5 py-0.5 rounded-full`}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
