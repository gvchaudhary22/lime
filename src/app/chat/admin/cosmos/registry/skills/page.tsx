"use client";

import { useEffect, useState } from "react";
import { Code2, Pencil, Tag, Wrench, Zap, Loader2, RefreshCw, Plus } from "lucide-react";
import { api, SkillRegistryEntry } from "@/lib/api";

const tierBadge = (tier: string) =>
  tier === "always_load"
    ? "bg-red-500/20 text-red-400 border-red-500/30"
    : tier === "auto_load"
    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
    : "bg-slate-500/20 text-slate-400 border-slate-500/30";

const sourceBadge = (source: string) =>
  source === "builtin"
    ? "bg-green-500/15 text-green-500 border-green-500/20"
    : "bg-purple-500/15 text-purple-400 border-purple-500/20";

export default function SkillBuilderPage() {
  const [skills, setSkills] = useState<SkillRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", tier: "auto_load" });
  const [saving, setSaving] = useState(false);

  const fetchSkills = async () => {
    setLoading(true);
    const res = await api.listSkills();
    if (res.success && res.data) setSkills(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    const res = await api.registerSkill({ name: form.name, tier: form.tier, tags: [] });
    if (res.success) {
      await fetchSkills();
      setShowForm(false);
      setForm({ name: "", description: "", tier: "auto_load" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Skill Builder</h1>
            <p className="text-xs text-slate-500">{skills.length} skills · builtin + custom from Mars DB</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSkills} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> Register Skill
          </button>
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Register Custom Skill</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Skill Name</label>
              <input
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="e.g. shipment-context"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tier</label>
              <select
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.tier}
                onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
              >
                <option value="always_load">always_load</option>
                <option value="auto_load">auto_load</option>
                <option value="on_demand">on_demand</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={saving || !form.name}
                className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading from database…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id || skill.name}
              className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 hover:border-purple-500/30 transition-all"
            >
              {/* Name + badges */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-mono font-medium text-sm">{skill.name}</h3>
                <div className="flex gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tierBadge(skill.tier)}`}>
                    {skill.tier}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sourceBadge(skill.source)}`}>
                    {skill.source}
                  </span>
                </div>
              </div>

              {/* Description */}
              {skill.description && (
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{skill.description}</p>
              )}

              {/* Triggers / intents */}
              {skill.intents && skill.intents.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                    <Tag className="w-3 h-3" /> Intents
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {skill.intents.slice(0, 4).map((intent) => (
                      <span key={intent} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                        {intent}
                      </span>
                    ))}
                    {skill.intents.length > 4 && (
                      <span className="text-[10px] text-slate-600">+{skill.intents.length - 4}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Phases */}
              {skill.phases && skill.phases.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                    <Wrench className="w-3 h-3" /> Phases
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {skill.phases.map((phase) => (
                      <span key={phase} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20 font-mono">
                        {phase}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags + edit */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  {skill.tags?.length || 0} tags
                </div>
                <button className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
