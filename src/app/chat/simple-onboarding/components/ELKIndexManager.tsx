"use client";

import { useEffect, useState } from "react";
import { api, ELKIndex } from "@/lib/api";
import { ChevronDown, ChevronUp, Trash2, Plus, Database } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "api", label: "API", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "job", label: "Job", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { value: "cron", label: "Cron", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { value: "webhook", label: "Webhook", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "kafka", label: "Kafka", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "other", label: "Other", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
];

function getCategoryStyle(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.color || CATEGORY_OPTIONS[5].color;
}

interface ELKIndexManagerProps {
  repoId: string;
}

export default function ELKIndexManager({ repoId }: ELKIndexManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [indexes, setIndexes] = useState<ELKIndex[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIndex, setNewIndex] = useState({ index_pattern: "", label: "", category: "api", description: "" });

  const loadIndexes = async () => {
    setLoading(true);
    const res = await api.listELKIndexes(repoId);
    if (res.success && res.data) setIndexes(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded && indexes.length === 0) loadIndexes();
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!newIndex.index_pattern.trim() || !newIndex.label.trim()) return;
    const res = await api.addELKIndex(repoId, {
      index_pattern: newIndex.index_pattern,
      label: newIndex.label,
      category: newIndex.category,
      description: newIndex.description,
    });
    if (res.success) {
      setNewIndex({ index_pattern: "", label: "", category: "api", description: "" });
      setShowAddForm(false);
      loadIndexes();
    }
  };

  const handleDelete = async (indexId: string) => {
    await api.deleteELKIndex(repoId, indexId);
    loadIndexes();
  };

  const handleToggle = async (idx: ELKIndex) => {
    await api.updateELKIndex(repoId, idx.id, { is_active: !idx.is_active });
    loadIndexes();
  };

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">ELK Indexes</span>
          <span className="text-[10px] text-slate-500">({indexes.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {loading ? (
            <div className="text-xs text-slate-500 py-2">Loading...</div>
          ) : indexes.length === 0 && !showAddForm ? (
            <div className="text-xs text-slate-500 py-2">No ELK indexes configured.</div>
          ) : (
            indexes.map(idx => (
              <div
                key={idx.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                  idx.is_active
                    ? "bg-white/[0.02] border-white/[0.06] hover:border-purple-500/20"
                    : "bg-white/[0.01] border-white/[0.04] opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getCategoryStyle(idx.category)}`}>
                    {idx.category}
                  </span>
                  <span className="text-xs text-slate-300 truncate">{idx.label}</span>
                  <span className="text-[10px] text-slate-500 truncate">{idx.index_pattern}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(idx)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      idx.is_active ? "text-green-400 hover:bg-green-500/10" : "text-slate-500 hover:bg-slate-500/10"
                    }`}
                  >
                    {idx.is_active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => handleDelete(idx.id)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}

          {showAddForm ? (
            <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.08]">
              <input
                type="text"
                value={newIndex.index_pattern}
                onChange={e => setNewIndex(prev => ({ ...prev, index_pattern: e.target.value }))}
                placeholder="Index pattern (e.g. shiprocket-api-*)"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              />
              <input
                type="text"
                value={newIndex.label}
                onChange={e => setNewIndex(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Label (e.g. API Logs)"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              />
              <div className="flex gap-2">
                <select
                  value={newIndex.category}
                  onChange={e => setNewIndex(prev => ({ ...prev, category: e.target.value }))}
                  className="bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newIndex.description}
                  onChange={e => setNewIndex(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newIndex.index_pattern.trim() || !newIndex.label.trim()}
                  className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 rounded text-xs text-purple-300 disabled:opacity-50"
                >
                  Add Index
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
            >
              <Plus className="w-3 h-3" /> Add ELK Index
            </button>
          )}
        </div>
      )}
    </div>
  );
}
