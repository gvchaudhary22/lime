"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Map,
  Loader2,
  Plus,
  Trash2,
  GitMerge,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  ProjectMapping,
  ServiceDependency,
  Project,
} from "@/lib/api";

type Tab = "mappings" | "dependencies";

export default function MappingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mappings");
  const [mappings, setMappings] = useState<ProjectMapping[]>([]);
  const [dependencies, setDependencies] = useState<ServiceDependency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    jira_project_key: "",
    mars_project_id: "",
    jira_component: "",
    service_name: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchAll();
  }, [router]);

  const fetchAll = async () => {
    setLoading(true);
    const [mapRes, depRes, projRes] = await Promise.all([
      api.getMappings(),
      api.getDependencies(),
      api.getProjects(),
    ]);
    if (mapRes.success && mapRes.data) setMappings(mapRes.data);
    if (depRes.success && depRes.data) setDependencies(depRes.data);
    if (projRes.success && projRes.data) setProjects(projRes.data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.jira_project_key || !form.mars_project_id) return;
    const res = await api.createMapping(form);
    if (res.success) {
      setShowForm(false);
      setForm({ jira_project_key: "", mars_project_id: "", jira_component: "", service_name: "" });
      fetchAll();
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteMapping(id);
    fetchAll();
  };

  const getProjectName = (id: string) => {
    const p = projects.find((p) => p.id === id);
    return p?.name || id.slice(0, 8);
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="mappings" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Map className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">
                Project Mappings
              </h1>
            </div>
            {tab === "mappings" && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Mapping
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Map Jira projects to MARS projects for automatic ticket routing
          </p>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/[0.06]">
            {(
              [
                { id: "mappings" as Tab, label: "Mappings", icon: Map },
                { id: "dependencies" as Tab, label: "Dependencies", icon: GitMerge },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.id
                    ? "text-purple-400 border-purple-500"
                    : "text-slate-400 border-transparent hover:text-white"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Create Form */}
          {showForm && tab === "mappings" && (
            <div className="mt-4 px-5 py-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
              <h3 className="text-sm font-medium text-white">New Mapping</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Jira Project Key (e.g. SHIP)"
                  value={form.jira_project_key}
                  onChange={(e) => setForm({ ...form, jira_project_key: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <select
                  value={form.mars_project_id}
                  onChange={(e) => setForm({ ...form, mars_project_id: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                  <option value="">Select MARS Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Jira Component (optional)"
                  value={form.jira_component}
                  onChange={(e) => setForm({ ...form, jira_component: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <input
                  type="text"
                  placeholder="Service Name (optional)"
                  value={form.service_name}
                  onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Mappings Tab */}
              {tab === "mappings" && (
                <div className="pt-4 space-y-3">
                  {mappings.length > 0 ? (
                    mappings.map((m) => (
                      <div
                        key={m.id}
                        className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-purple-400">
                              {m.jira_project_key}
                            </span>
                            {m.jira_component && (
                              <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                                {m.jira_component}
                              </span>
                            )}
                            <span className="text-slate-500">&rarr;</span>
                            <span className="text-sm text-white">
                              {getProjectName(m.mars_project_id)}
                            </span>
                          </div>
                          {m.service_name && (
                            <span className="text-xs text-slate-500">
                              Service: {m.service_name}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No mappings yet. Create one to link Jira projects to MARS projects.
                    </div>
                  )}
                </div>
              )}

              {/* Dependencies Tab */}
              {tab === "dependencies" && (
                <div className="pt-4 space-y-3">
                  {dependencies.length > 0 ? (
                    dependencies.map((d) => (
                      <div
                        key={d.id}
                        className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white">
                            {d.source_repo_id.slice(0, 8)}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {d.dependency_type}
                          </span>
                          <span className="text-slate-500">&rarr;</span>
                          <span className="text-sm text-white">
                            {d.target_repo_id.slice(0, 8)}
                          </span>
                        </div>
                        {d.contract_name && (
                          <span className="text-xs text-slate-500 mt-1 block">
                            Contract: {d.contract_name}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No service dependencies defined yet.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
