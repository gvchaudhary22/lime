"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Loader2,
  FileText,
  Layers,
  PenLine,
  History,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  RepositoryKnowledge,
  ModuleKnowledge,
  KnowledgeContribution,
} from "@/lib/api";

type Tab = "repo" | "modules" | "contributions";

interface RepoOption {
  id: string;
  name: string;
}

export default function KnowledgePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("repo");
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState(false);

  // Repo KB
  const [repoKB, setRepoKB] = useState<RepositoryKnowledge | null>(null);
  const [editingCanonical, setEditingCanonical] = useState(false);
  const [canonicalDraft, setCanonicalDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Module KBs
  const [modules, setModules] = useState<ModuleKnowledge[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleKnowledge | null>(null);

  // Contributions
  const [contributions, setContributions] = useState<KnowledgeContribution[]>([]);
  const [contribFilter, setContribFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchRepos();
  }, [router]);

  useEffect(() => {
    if (selectedRepo) fetchTabData();
  }, [selectedRepo, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRepos = async () => {
    const res = await api.getProjects();
    if (res.success && res.data) {
      setRepos(res.data.map((p) => ({ id: p.repository_id || p.id, name: p.name })));
      if (res.data.length > 0) setSelectedRepo(res.data[0].repository_id || res.data[0].id);
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    if (tab === "repo") {
      const res = await api.getRepoKnowledge(selectedRepo);
      if (res.success && res.data) {
        setRepoKB(res.data);
        setCanonicalDraft(res.data.canonical_content || "");
      } else {
        setRepoKB(null);
      }
    } else if (tab === "modules") {
      const res = await api.listModuleKnowledge(selectedRepo);
      if (res.success && res.data) setModules(res.data);
      else setModules([]);
    } else {
      const params: { repo_id?: string; status?: string } = { repo_id: selectedRepo };
      if (contribFilter !== "all") params.status = contribFilter;
      const res = await api.listContributions(params);
      if (res.success && res.data) setContributions(res.data);
      else setContributions([]);
    }
    setLoading(false);
  };

  const handleSaveCanonical = async () => {
    setSaving(true);
    await api.updateCanonical(selectedRepo, canonicalDraft);
    setEditingCanonical(false);
    setSaving(false);
    fetchTabData();
  };

  const handleRegenerate = async () => {
    setLoading(true);
    await api.regenerateMaterialized(selectedRepo);
    fetchTabData();
  };

  const handleReviewContribution = async (id: string, action: string) => {
    await api.reviewContribution(id, { action });
    fetchTabData();
  };

  const confidenceColor = (conf: string) => {
    const colors: Record<string, string> = {
      manager_confirmed: "text-green-400 bg-green-500/10",
      ai_seeded: "text-blue-400 bg-blue-500/10",
      discovered: "text-yellow-400 bg-yellow-500/10",
    };
    return colors[conf] || "text-slate-400 bg-white/[0.05]";
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case "rejected": return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10",
      approved: "text-green-400 bg-green-500/10",
      rejected: "text-red-400 bg-red-500/10",
    };
    return colors[status] || "text-slate-400 bg-white/[0.05]";
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="knowledge" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          </div>

          {/* Repo selector */}
          <div className="flex items-center gap-4 mb-4">
            <select
              value={selectedRepo}
              onChange={(e) => { setSelectedRepo(e.target.value); setSelectedModule(null); }}
              className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="">Select a repository</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/[0.06]">
            {([
              { id: "repo" as Tab, label: "Repository KB", icon: FileText },
              { id: "modules" as Tab, label: "Modules", icon: Layers },
              { id: "contributions" as Tab, label: "Contributions", icon: PenLine },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSelectedModule(null); }}
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Repo KB Tab */}
              {tab === "repo" && (
                <div className="pt-4 space-y-6">
                  {repoKB ? (
                    <>
                      {/* Canonical Knowledge */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-white">Canonical Knowledge (v{repoKB.canonical_version})</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingCanonical(!editingCanonical)}
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              {editingCanonical ? "Cancel" : "Edit"}
                            </button>
                            {editingCanonical && (
                              <button
                                onClick={handleSaveCanonical}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-600 text-white rounded-lg"
                              >
                                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                        {editingCanonical ? (
                          <textarea
                            value={canonicalDraft}
                            onChange={(e) => setCanonicalDraft(e.target.value)}
                            rows={10}
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white font-mono resize-none focus:outline-none focus:border-purple-500/30"
                          />
                        ) : (
                          <pre className="text-xs text-slate-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {repoKB.canonical_content || "No canonical knowledge yet. Click Edit to add."}
                          </pre>
                        )}
                      </div>

                      {/* Materialized Summary */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-white">Materialized Summary</h3>
                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Regenerate
                          </button>
                        </div>
                        <pre className="text-xs text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {repoKB.materialized_summary || "No materialized summary. Approve module contributions to auto-generate."}
                        </pre>
                        <div className="flex gap-4 mt-3 text-xs text-slate-500">
                          <span>{repoKB.module_count} modules</span>
                          {repoKB.materialized_updated_at && (
                            <span>Updated: {new Date(repoKB.materialized_updated_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-slate-500 text-sm">
                      No repository knowledge found. Onboard a repo to auto-create.
                    </div>
                  )}
                </div>
              )}

              {/* Modules Tab */}
              {tab === "modules" && !selectedModule && (
                <div className="pt-4 space-y-3">
                  {modules.length > 0 ? (
                    modules.map((mod) => (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModule(mod)}
                        className="w-full text-left px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-white">{mod.module_name}</span>
                            <span className="text-xs text-slate-500 ml-2">{mod.module_path}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${confidenceColor(mod.confidence)}`}>
                              {mod.confidence}
                            </span>
                            <span className="text-xs text-slate-500">v{mod.version}</span>
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </div>
                        </div>
                        {mod.routing_summary && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{mod.routing_summary}</p>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-16 text-slate-500 text-sm">
                      No module knowledge yet. Onboard a repo to discover modules.
                    </div>
                  )}
                </div>
              )}

              {/* Module Detail */}
              {tab === "modules" && selectedModule && (
                <div className="pt-4 space-y-4">
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Back to modules
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-white">{selectedModule.module_name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded ${confidenceColor(selectedModule.confidence)}`}>
                      {selectedModule.confidence}
                    </span>
                    <span className="text-xs text-slate-500">v{selectedModule.version}</span>
                  </div>

                  {/* Sections */}
                  {[
                    { key: "purpose", label: "Purpose" },
                    { key: "entrypoints", label: "Entrypoints" },
                    { key: "apis_events", label: "APIs & Events" },
                    { key: "db_touchpoints", label: "DB Touchpoints" },
                    { key: "failure_patterns", label: "Failure Patterns" },
                    { key: "learnings", label: "Learnings" },
                  ].map((section) => {
                    const content = selectedModule[section.key as keyof ModuleKnowledge] as string;
                    return (
                      <div key={section.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{section.label}</h3>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                          {content || "—"}
                        </pre>
                      </div>
                    );
                  })}

                  {selectedModule.routing_summary && (
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                      <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2">Routing Summary</h3>
                      <p className="text-xs text-slate-300">{selectedModule.routing_summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Contributions Tab */}
              {tab === "contributions" && (
                <div className="pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    {["all", "pending", "approved", "rejected"].map((f) => (
                      <button
                        key={f}
                        onClick={() => { setContribFilter(f); setTimeout(fetchTabData, 0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          contribFilter === f
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-white/[0.03] text-slate-500 border border-white/[0.06]"
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {contributions.length > 0 ? (
                      contributions.map((c) => (
                        <div key={c.id} className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {statusIcon(c.status)}
                              <span className="text-sm font-medium text-white">{c.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{c.target_section}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>
                                {c.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">{c.content}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <div className="flex gap-3">
                              <span>{c.source_type}</span>
                              <span>{c.module_path}</span>
                            </div>
                            {c.status === "pending" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReviewContribution(c.id, "approve")}
                                  className="px-3 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReviewContribution(c.id, "reject")}
                                  className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16 text-slate-500 text-sm">
                        No contributions found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
