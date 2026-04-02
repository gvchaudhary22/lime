"use client";

import { useEffect, useState } from "react";
import {
  Wrench, Plus, Sparkles, Pencil, Ban, Check, X, Loader2, RefreshCw,
} from "lucide-react";
import { api, RegistryTool } from "@/lib/api";

const typeBadge = (t: string) =>
  t === "READ" || t === "database" || t === "api"
    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
    : "bg-orange-500/20 text-orange-400 border-orange-500/30";

const riskBadge = (r: string) =>
  r === "low"
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : r === "medium"
    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";

export default function ToolRegistryPage() {
  const [toolList, setToolList] = useState<RegistryTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", type: "READ", risk: "low" });
  const [saving, setSaving] = useState(false);

  const fetchTools = async () => {
    setLoading(true);
    const res = await api.listTools();
    if (res.success && res.data) setToolList(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchTools(); }, []);

  const toggleStatus = async (tool: RegistryTool) => {
    const newStatus = tool.status === "active" ? "disabled" : "active";
    const res = await api.updateTool(tool.id, { ...tool, status: newStatus });
    if (res.success && res.data) {
      setToolList((prev) => prev.map((t) => t.id === tool.id ? res.data! : t));
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await api.createTool({
      name: form.name,
      description: "",
      category: form.type === "READ" ? "database" : "api",
      endpoint: "",
      method: form.type === "READ" ? "GET" : "POST",
      input_schema: [],
      output_description: "",
      tags: [form.domain],
      status: "active",
      agent_access: [],
      source: "manual",
    });
    if (res.success && res.data) {
      setToolList((prev) => [...prev, res.data!]);
      setShowForm(false);
      setForm({ name: "", domain: "", type: "READ", risk: "low" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteTool(id);
    setToolList((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-green-600 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tool Registry</h1>
            <p className="text-xs text-slate-500">{toolList.length} tools · from Mars DB</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTools}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
            <Sparkles className="w-4 h-4" />
            Generate from KB
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-sm hover:bg-green-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Tool
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">New Tool</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tool Name</label>
              <input
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="e.g. order_lookup"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Domain</label>
              <input
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="e.g. orders"
                value={form.domain}
                onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Type</label>
              <select
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option>READ</option>
                <option>WRITE</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Risk Level</label>
              <select
                className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.risk}
                onChange={(e) => setForm((p) => ({ ...p, risk: e.target.value }))}
              >
                <option>low</option>
                <option>medium</option>
                <option>high</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Tool"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading from database…
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Name</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Category</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Method</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Source</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Status</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {toolList.map((tool) => (
                <tr key={tool.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm text-white font-mono">{tool.name}</span>
                    {tool.description && <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[200px]">{tool.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge(tool.category)}`}>
                      {tool.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400 font-mono">{tool.method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">{tool.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    {tool.status === "active" ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Check className="w-3 h-3" /> active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Ban className="w-3 h-3" /> {tool.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(tool)}
                        className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                          tool.status === "active"
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        }`}
                      >
                        <Ban className="w-3 h-3" /> {tool.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(tool.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
