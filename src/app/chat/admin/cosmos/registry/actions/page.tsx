"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Filter, ChevronDown, X, Loader2, RefreshCw, Plus } from "lucide-react";
import { api, RegistryAction } from "@/lib/api";

const riskBadge = (r: string) =>
  r === "low"
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : r === "medium"
    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";

const kindBadge = (k: string) =>
  k === "invoke_api" || k === "api_action"
    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
    : "bg-purple-500/20 text-purple-400 border-purple-500/30";

const approvalColor = (a: string) =>
  a === "auto" ? "text-green-400" : a === "confirm" ? "text-yellow-400" : "text-red-400";

export default function ActionContractsPage() {
  const [actions, setActions] = useState<RegistryAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState("All");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAction, setSelectedAction] = useState<RegistryAction | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", domain: "", action_type: "invoke_api", risk_level: "low", approval_mode: "auto" });
  const [saving, setSaving] = useState(false);

  const fetchActions = async () => {
    setLoading(true);
    const res = await api.listActions();
    if (res.success && res.data) setActions(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchActions(); }, []);

  const domains = ["All", ...Array.from(new Set(actions.map((a) => a.domain).filter(Boolean)))];

  const filtered = domainFilter === "All" ? actions : actions.filter((a) => a.domain === domainFilter);

  const grouped = filtered.reduce<Record<string, RegistryAction[]>>((acc, a) => {
    const key = a.domain || "General";
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  const handleCreate = async () => {
    setSaving(true);
    const res = await api.createAction({
      name: form.name,
      description: form.description,
      action_type: form.action_type,
      input_schema: [],
      output_description: "",
      tags: [],
      status: "active",
      risk_level: form.risk_level,
      approval_mode: form.approval_mode,
      domain: form.domain,
      source: "manual",
    });
    if (res.success && res.data) {
      setActions((prev) => [...prev, res.data!]);
      setShowCreate(false);
      setForm({ name: "", description: "", domain: "", action_type: "invoke_api", risk_level: "low", approval_mode: "auto" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteAction(id);
    setActions((prev) => prev.filter((a) => a.id !== id));
    if (selectedAction?.id === id) setSelectedAction(null);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Action Contracts</h1>
            <p className="text-xs text-slate-500">{actions.length} actions · from Mars DB</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchActions} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400 text-sm hover:bg-rose-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Action
          </button>

          {/* Domain Filter */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111830] border border-white/[0.06] text-sm text-slate-300 hover:border-purple-500/30 transition-colors"
            >
              <Filter className="w-4 h-4 text-slate-500" />
              {domainFilter}
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-44 bg-[#111830] border border-white/[0.06] rounded-lg shadow-xl z-10 py-1">
                {domains.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDomainFilter(d); setShowDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.04] transition-colors ${
                      d === domainFilter ? "text-purple-400" : "text-slate-400"
                    }`}
                  >
                    {d}
                    {d !== "All" && (
                      <span className="ml-2 text-xs text-slate-600">
                        ({actions.filter((a) => a.domain === d).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">New Action</h3>
            <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Name</label>
              <input className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="e.g. cancel_order" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Domain</label>
              <input className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="e.g. Orders" value={form.domain}
                onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Type</label>
              <select className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.action_type} onChange={(e) => setForm((p) => ({ ...p, action_type: e.target.value }))}>
                <option value="invoke_api">invoke_api</option>
                <option value="async_job">async_job</option>
                <option value="run_flow">run_flow</option>
                <option value="send_notification">send_notification</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Risk</label>
              <select className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.risk_level} onChange={(e) => setForm((p) => ({ ...p, risk_level: e.target.value }))}>
                <option>low</option><option>medium</option><option>high</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Approval</label>
              <select className="w-full bg-[#0a0f1c] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white"
                value={form.approval_mode} onChange={(e) => setForm((p) => ({ ...p, approval_mode: e.target.value }))}>
                <option>auto</option><option>confirm</option><option>manual</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="w-full px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Action"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAction && (
        <div className="bg-[#111830] border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">{selectedAction.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(selectedAction.id)}
                className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
              <button onClick={() => setSelectedAction(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">ID:</span><span className="ml-2 text-slate-300 font-mono text-xs">{selectedAction.id}</span></div>
            <div><span className="text-slate-500">Domain:</span><span className="ml-2 text-slate-300">{selectedAction.domain}</span></div>
            <div>
              <span className="text-slate-500">Type:</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${kindBadge(selectedAction.action_type)}`}>{selectedAction.action_type}</span>
            </div>
            <div>
              <span className="text-slate-500">Risk:</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${riskBadge(selectedAction.risk_level)}`}>{selectedAction.risk_level}</span>
            </div>
            <div><span className="text-slate-500">Approval:</span><span className={`ml-2 ${approvalColor(selectedAction.approval_mode)}`}>{selectedAction.approval_mode}</span></div>
            <div><span className="text-slate-500">Source:</span><span className="ml-2 text-slate-400">{selectedAction.source}</span></div>
          </div>
          {selectedAction.description && (
            <p className="mt-3 text-xs text-slate-500">{selectedAction.description}</p>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading from database…
        </div>
      )}

      {/* Grouped Cards */}
      {!loading && Object.entries(grouped).map(([domain, acts]) => (
        <div key={domain}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {domain} <span className="text-slate-600">({acts.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {acts.map((action) => (
              <button
                key={action.id}
                onClick={() => setSelectedAction(action)}
                className="bg-[#111830] border border-white/[0.06] rounded-xl p-4 text-left hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-mono text-sm">{action.name}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{action.id.slice(0, 11)}…</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${kindBadge(action.action_type)}`}>{action.action_type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${riskBadge(action.risk_level)}`}>{action.risk_level}</span>
                  <span className={`text-xs ${approvalColor(action.approval_mode)}`}>{action.approval_mode}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
