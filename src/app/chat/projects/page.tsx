"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MessageSquare,
  ExternalLink,
  Star,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  BookOpen,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import CreateProjectModal from "@/components/project/CreateProjectModal";
import { api, Project, Repository, KBSyncPreview } from "@/lib/api";

interface DisplayProject {
  id: string;
  name: string;
  description: string;
  link?: string;
  qa_env_verified?: boolean;
  is_starred?: boolean;
  conversation_count: number;
  updated_at: string;
  source: "project" | "repository";
  route: string;
  kb_status?: string;
  kb_pending_files?: number;
  last_kb_sync_at?: string | null;
}

interface KBSyncModalState {
  repoId: string;
  repoName: string;
  step: "token" | "previewing" | "preview" | "applying" | "done" | "error";
  token: string;
  preview: KBSyncPreview | null;
  error: string;
  filesMarked: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<DisplayProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [kbModal, setKbModal] = useState<KBSyncModalState | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchProjects();
  }, [router]);

  const fetchProjects = async () => {
    let projRes, repoRes;
    try {
      [projRes, repoRes] = await Promise.all([
        api.getProjects(),
        api.listRepositories(),
      ]);
    } catch {
      setLoading(false);
      return;
    }

    const items: DisplayProject[] = [];
    const repoIdsWithProjects = new Set<string>();

    if (projRes.success && projRes.data) {
      projRes.data.forEach((p: Project) => {
        if (p.repository_id) repoIdsWithProjects.add(p.repository_id);
        items.push({
          id: p.id,
          name: p.name,
          description: p.description,
          link: p.link,
          qa_env_verified: p.qa_env_verified,
          is_starred: p.is_starred,
          conversation_count: p.conversation_count,
          updated_at: p.updated_at,
          source: "project",
          route: `/chat/projects/${p.id}`,
        });
      });
    }

    if (repoRes.success && repoRes.data) {
      repoRes.data
        .filter((r: Repository) =>
          !repoIdsWithProjects.has(r.id) &&
          (r.onboarding_status === "completed" || r.onboarding_status === "complete" || r.clone_path)
        )
        .forEach((r: Repository) => {
          items.push({
            id: r.id,
            name: r.name,
            description: r.description || `${r.git_url || "Onboarded repository"}`,
            link: r.git_url,
            qa_env_verified: false,
            is_starred: false,
            conversation_count: 0,
            updated_at: r.updated_at || r.created_at,
            source: "repository",
            route: `/chat/simple-onboarding`,
            kb_status: r.kb_status,
            kb_pending_files: r.kb_pending_files,
            last_kb_sync_at: r.last_kb_sync_at,
          });
        });
    }

    setProjects(items);
    setLoading(false);
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  }

  function openKBSync(project: DisplayProject, e: React.MouseEvent) {
    e.stopPropagation();
    setKbModal({
      repoId: project.id,
      repoName: project.name,
      step: "token",
      token: "",
      preview: null,
      error: "",
      filesMarked: 0,
    });
  }

  async function handleKBPreview() {
    if (!kbModal || !kbModal.token) return;
    setKbModal((m) => m ? { ...m, step: "previewing", error: "" } : null);
    const res = await api.previewKBSync(kbModal.repoId, kbModal.token);
    if (res.success && res.data) {
      setKbModal((m) => m ? { ...m, step: "preview", preview: res.data! } : null);
    } else {
      setKbModal((m) => m ? { ...m, step: "error", error: res.error || "Preview failed" } : null);
    }
  }

  async function handleKBApply() {
    if (!kbModal || !kbModal.token) return;
    setKbModal((m) => m ? { ...m, step: "applying", error: "" } : null);
    const res = await api.applyKBSync(kbModal.repoId, kbModal.token);
    if (res.success && res.data) {
      setKbModal((m) => m ? { ...m, step: "done", filesMarked: res.data!.files_marked } : null);
      fetchProjects(); // refresh KB status badges
    } else {
      setKbModal((m) => m ? { ...m, step: "error", error: res.error || "Sync failed" } : null);
    }
  }

  function kbStatusBadge(status?: string, pending?: number) {
    if (!status || status === "none") return null;
    const colors: Record<string, string> = {
      trained: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      training: "text-blue-400 border-blue-500/30 bg-blue-500/10",
      generating: "text-blue-400 border-blue-500/30 bg-blue-500/10",
      failed: "text-red-400 border-red-500/30 bg-red-500/10",
      pending: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    };
    const label = pending && pending > 0 ? `KB (${pending} pending)` : `KB ${status}`;
    const cls = colors[status] || "text-slate-400 border-slate-500/30 bg-slate-500/10";
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls} font-medium`}>
        {label}
      </span>
    );
  }

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="projects" />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create project
            </button>
          </div>

          {/* Search and Sort */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors">
              Activity
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Project cards grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <p className="text-lg">No projects found</p>
              <p className="text-sm mt-1">
                {search
                  ? "Try a different search"
                  : "Create your first project"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {filtered.map((project) => (
                <div
                  key={project.id}
                  onClick={() =>
                    router.push(project.route)
                  }
                  className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/20 transition-all cursor-pointer p-5 flex flex-col"
                >
                  {/* Status indicators */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {project.qa_env_verified ? (
                      <span title="Chat-ready (QA env verified)">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </span>
                    ) : (
                      <span title="Not chat-ready (QA env not verified)">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      </span>
                    )}
                    {project.is_starred && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>

                  {/* Project name */}
                  <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors mb-2 pr-6">
                    {project.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-slate-400 line-clamp-2 mb-4 flex-1">
                    {project.description || "No description"}
                  </p>

                  {/* KB status badge */}
                  {project.source === "repository" && project.kb_status && project.kb_status !== "none" && (
                    <div className="mb-2">
                      {kbStatusBadge(project.kb_status, project.kb_pending_files)}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {project.conversation_count}
                      </span>
                      <span>{timeAgo(project.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                    {project.source === "repository" && (
                      <button
                        onClick={(e) => openKBSync(project, e)}
                        title="Sync KB from latest merged PRs"
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        KB Sync
                      </button>
                    )}

                    {project.link && (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Repo
                      </a>
                    )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchProjects}
      />

      {/* KB Sync Modal */}
      {kbModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] rounded-xl border border-[#222] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">KB Sync — {kbModal.repoName}</h2>
              </div>
              <button onClick={() => setKbModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: Enter GitHub token */}
            {kbModal.step === "token" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Fetch merged PRs since the last KB sync and preview what knowledge base files would be updated.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    value={kbModal.token}
                    onChange={(e) => setKbModal((m) => m ? { ...m, token: e.target.value } : null)}
                    placeholder="ghp_..."
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <button
                  onClick={handleKBPreview}
                  disabled={!kbModal.token}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Preview Changes
                </button>
              </div>
            )}

            {/* Step: Previewing */}
            {kbModal.step === "previewing" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-sm text-slate-400">Fetching merged PRs and analysing changes…</p>
              </div>
            )}

            {/* Step: Preview result */}
            {kbModal.step === "preview" && kbModal.preview && (
              <div className="space-y-4">
                {kbModal.preview.total_prs === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300">KB is up to date — no new merged PRs found.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/[0.04] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-white">{kbModal.preview.total_prs}</p>
                        <p className="text-xs text-slate-400 mt-1">PRs scanned</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-400">{kbModal.preview.api_changes}</p>
                        <p className="text-xs text-slate-400 mt-1">API changes</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{kbModal.preview.schema_changes + kbModal.preview.model_changes}</p>
                        <p className="text-xs text-slate-400 mt-1">Schema changes</p>
                      </div>
                    </div>

                    {kbModal.preview.changes.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Detected Changes</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {kbModal.preview.changes.map((c, i) => (
                            <div key={i} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  c.kb_pillar === "pillar_3" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"
                                }`}>
                                  {c.kb_pillar}
                                </span>
                                <span className="text-[10px] text-slate-500">{c.change_type}</span>
                              </div>
                              <p className="text-xs text-slate-300">{c.description}</p>
                              <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">{c.source_file}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setKbModal((m) => m ? { ...m, step: "token" } : null)}
                        className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm rounded-lg transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleKBApply}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Apply Sync ({kbModal.preview.affected_kb_files.length} files)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step: Applying */}
            {kbModal.step === "applying" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-sm text-slate-400">Marking KB files for re-embedding in COSMOS…</p>
              </div>
            )}

            {/* Step: Done */}
            {kbModal.step === "done" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
                <p className="text-base font-semibold text-white">KB sync complete</p>
                <p className="text-sm text-slate-400">
                  {kbModal.filesMarked} KB file{kbModal.filesMarked !== 1 ? "s" : ""} marked for re-embedding.
                  COSMOS will process them within 5 minutes.
                </p>
                <button
                  onClick={() => setKbModal(null)}
                  className="mt-2 px-6 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-sm rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Step: Error */}
            {kbModal.step === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-base font-semibold text-white">Sync failed</p>
                <p className="text-sm text-red-400">{kbModal.error}</p>
                <button
                  onClick={() => setKbModal((m) => m ? { ...m, step: "token", error: "" } : null)}
                  className="mt-2 px-6 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-sm rounded-lg transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
