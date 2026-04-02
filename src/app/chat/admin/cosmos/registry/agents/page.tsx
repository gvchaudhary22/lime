"use client";

import { useEffect, useState } from "react";
import {
  Bot, Plus, X, Wrench, Tag, Zap, Code2, ChevronRight,
  Check, Ban, Trash2, RefreshCw, Loader2,
} from "lucide-react";
import { api, RegistryAgent, RegistryTool, RegistryAction, SkillRegistryEntry } from "@/lib/api";

const typeBadge = (t: string) =>
  t === "support"
    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
    : t === "specialist"
    ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
    : "bg-orange-500/20 text-orange-400 border-orange-500/30";

const statusDot = (s: string) =>
  s === "active" ? "text-green-400" : s === "draft" ? "text-yellow-400" : "text-slate-500";

const BLANK_AGENT: Omit<RegistryAgent, "id" | "created_at" | "updated_at"> = {
  name: "", description: "", slug: "", agent_type: "support",
  system_prompt: "", model_hint: "", temperature: 0.7, max_tokens: 2048,
  domains: [], tags: [], status: "draft", created_by: "",
  tools: [], skills: [], actions: [],
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [skills, setSkills] = useState<SkillRegistryEntry[]>([]);
  const [actions, setActions] = useState<RegistryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RegistryAgent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...BLANK_AGENT });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [ar, tr, sr, acr] = await Promise.all([
      api.listAgents(),
      api.listTools(),
      api.listSkills(),
      api.listActions(),
    ]);
    if (ar.success && ar.data) setAgents(ar.data);
    if (tr.success && tr.data) setTools(tr.data);
    if (sr.success && sr.data) setSkills(sr.data);
    if (acr.success && acr.data) setActions(acr.data);
    setLoading(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await api.createAgent(form);
    if (res.success && res.data) {
      setAgents((prev) => [...prev, res.data!]);
      setShowCreate(false);
      setForm({ ...BLANK_AGENT });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    const res = await api.deleteAgent(id);
    if (res.success) {
      setAgents((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) setSelected(null);
    }
  };

  const handleResetLinks = async (id: string) => {
    setResetting(id);
    await api.resetAgentLinks(id);
    const res = await api.getAgent(id);
    if (res.success && res.data) {
      setAgents((prev) => prev.map((a) => a.id === id ? res.data! : a));
      if (selected?.id === id) setSelected(res.data!);
    }
    setResetting(null);
  };

  const toggleLink = (field: "tools" | "skills" | "actions", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const agentTools = (agent: RegistryAgent) =>
    tools.filter((t) => agent.tools.includes(t.id));
  const agentSkills = (agent: RegistryAgent) =>
    skills.filter((s) => agent.skills.includes(s.id));
  const agentActions = (agent: RegistryAgent) =>
    actions.filter((a) => agent.actions.includes(a.id));

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* Left panel: agent list */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Agents</h1>
              <p className="text-[10px] text-slate-500">{agents.length} registered</p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setSelected(null); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-600/30 transition-colors"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {/* Agent list */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { setSelected(agent); setShowCreate(false); }}
                className={`w-full text-left bg-[#111830] border rounded-xl p-3 hover:border-violet-500/30 transition-all ${
                  selected?.id === agent.id ? "border-violet-500/40" : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-mono font-medium truncate">{agent.name}</span>
                  <span className={`text-[10px] ${statusDot(agent.status)}`}>●</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${typeBadge(agent.agent_type)}`}>
                    {agent.agent_type}
                  </span>
                  <span className="text-[10px] text-slate-600">{agent.tools.length}T · {agent.skills.length}S · {agent.actions.length}A</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: detail or create form */}
      <div className="flex-1 min-w-0">
        {showCreate && (
          <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-medium">New Agent</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                  placeholder="e.g. Support Agent"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Slug</label>
                <input
                  className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                  placeholder="e.g. support_agent"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Type</label>
                <select
                  className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                  value={form.agent_type}
                  onChange={(e) => setForm((p) => ({ ...p, agent_type: e.target.value }))}
                >
                  <option>support</option>
                  <option>specialist</option>
                  <option>technical</option>
                  <option>orchestrator</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Status</label>
                <select
                  className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option>draft</option>
                  <option>active</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Description</label>
              <input
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="What does this agent do?"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">System Prompt</label>
              <textarea
                rows={3}
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none"
                placeholder="You are a Shiprocket support agent…"
                value={form.system_prompt}
                onChange={(e) => setForm((p) => ({ ...p, system_prompt: e.target.value }))}
              />
            </div>

            {/* Tool picker */}
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                <Wrench className="w-3 h-3" /> Assign Tools
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleLink("tools", t.id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.tools.includes(t.id)
                        ? "bg-teal-500/30 text-teal-300 border-teal-500/50"
                        : "bg-teal-500/10 text-teal-500 border-teal-500/20 hover:border-teal-500/40"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill picker */}
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                <Code2 className="w-3 h-3" /> Assign Skills
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleLink("skills", s.id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.skills.includes(s.id)
                        ? "bg-purple-500/30 text-purple-300 border-purple-500/50"
                        : "bg-purple-500/10 text-purple-500 border-purple-500/20 hover:border-purple-500/40"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Action picker */}
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                <Zap className="w-3 h-3" /> Assign Actions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggleLink("actions", a.id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      form.actions.includes(a.id)
                        ? "bg-orange-500/30 text-orange-300 border-orange-500/50"
                        : "bg-orange-500/10 text-orange-500 border-orange-500/20 hover:border-orange-500/40"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || !form.slug}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Agent"}
              </button>
            </div>
          </div>
        )}

        {selected && !showCreate && (
          <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-6 space-y-6">
            {/* Agent header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white font-semibold text-lg">{selected.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge(selected.agent_type)}`}>
                    {selected.agent_type}
                  </span>
                  <span className={`text-xs ${statusDot(selected.status)}`}>
                    {selected.status === "active" ? <Check className="w-3 h-3 inline" /> : <Ban className="w-3 h-3 inline" />} {selected.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{selected.description}</p>
                <p className="text-slate-600 text-xs mt-1 font-mono">slug: {selected.slug}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResetLinks(selected.id)}
                  disabled={resetting === selected.id}
                  title="Clear all tool/skill/action links for this agent"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                >
                  {resetting === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Reset Links
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>

            {/* System prompt */}
            {selected.system_prompt && (
              <div className="bg-[#0a0f1c] rounded-lg p-4 border border-white/[0.04]">
                <p className="text-xs text-slate-500 mb-2">System Prompt</p>
                <p className="text-slate-300 text-sm leading-relaxed">{selected.system_prompt}</p>
              </div>
            )}

            {/* Model config */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0a0f1c] rounded-lg p-3 border border-white/[0.04]">
                <p className="text-[10px] text-slate-500 mb-1">Model</p>
                <p className="text-white text-sm">{selected.model_hint || "auto"}</p>
              </div>
              <div className="bg-[#0a0f1c] rounded-lg p-3 border border-white/[0.04]">
                <p className="text-[10px] text-slate-500 mb-1">Temperature</p>
                <p className="text-white text-sm">{selected.temperature}</p>
              </div>
              <div className="bg-[#0a0f1c] rounded-lg p-3 border border-white/[0.04]">
                <p className="text-[10px] text-slate-500 mb-1">Max Tokens</p>
                <p className="text-white text-sm">{selected.max_tokens}</p>
              </div>
            </div>

            {/* Tools */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Wrench className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-slate-300">Tools ({agentTools(selected).length})</h3>
              </div>
              {agentTools(selected).length === 0 ? (
                <p className="text-xs text-slate-600">No tools linked</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {agentTools(selected).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-[#0a0f1c] rounded-lg p-3 border border-white/[0.04]">
                      <ChevronRight className="w-3 h-3 text-teal-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white text-xs font-mono truncate">{t.name}</p>
                        <p className="text-slate-600 text-[10px]">{t.category} · {t.method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skills */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Code2 className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-300">Skills ({agentSkills(selected).length})</h3>
              </div>
              {agentSkills(selected).length === 0 ? (
                <p className="text-xs text-slate-600">No skills linked</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {agentSkills(selected).map((s) => (
                    <span
                      key={s.id}
                      title={s.description}
                      className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    >
                      {s.name} <span className="text-purple-600">·</span> {s.tier}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-slate-300">Actions ({agentActions(selected).length})</h3>
              </div>
              {agentActions(selected).length === 0 ? (
                <p className="text-xs text-slate-600">No actions linked</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {agentActions(selected).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 bg-[#0a0f1c] rounded-lg p-3 border border-white/[0.04]">
                      <Tag className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white text-xs font-mono truncate">{a.name}</p>
                        <p className="text-slate-600 text-[10px]">{a.domain || a.action_type} · {a.approval_mode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Domains & tags */}
            {(selected.domains.length > 0 || selected.tags.length > 0) && (
              <div className="pt-4 border-t border-white/[0.04] flex flex-wrap gap-1.5">
                {selected.domains.map((d) => (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">{d}</span>
                ))}
                {selected.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-white/[0.06]">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!selected && !showCreate && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <Bot className="w-8 h-8 mb-2" />
            <p className="text-sm">Select an agent to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
