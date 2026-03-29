"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BookOpen,
  Activity,
} from "lucide-react";

const MARS_URL = process.env.NEXT_PUBLIC_MARS_URL || "http://localhost:8080";

interface KBUpdateEvent {
  id: string;
  repo: string;
  commit_message: string;
  commit_sha: string;
  affected_modules: string[];
  affected_pillars: string[];
  estimated_retrain_docs: number;
  status: "pending" | "approved" | "skipped" | "training" | "trained" | "failed";
  created_at: string;
  approved_at?: string;
  trained_at?: string;
  error?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("mars_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function marsRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${MARS_URL}/api/v1${endpoint}`, {
    method,
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock },
  approved: { bg: "bg-blue-500/10", text: "text-blue-400", icon: CheckCircle },
  training: { bg: "bg-purple-500/10", text: "text-purple-400", icon: Loader2 },
  trained: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle },
  skipped: { bg: "bg-slate-500/10", text: "text-slate-400", icon: XCircle },
  failed: { bg: "bg-red-500/10", text: "text-red-400", icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className={`w-3 h-3 ${status === "training" ? "animate-spin" : ""}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SYNC_REPOS = [
  { id: "MultiChannel_API", label: "MultiChannel API", desc: "Backend — orders, shipments, billing" },
  { id: "SR_Web", label: "SR Web", desc: "Seller panel — Angular" },
  { id: "MultiChannel_Web", label: "MultiChannel Web", desc: "ICRM admin — AngularJS" },
  { id: "shiprocket-go", label: "Shiprocket Go", desc: "Go backend services" },
  { id: "shiprocket-channels", label: "Channels", desc: "Marketplace integrations" },
  { id: "SR_Sidebar", label: "SR Sidebar", desc: "Sidebar component" },
  { id: "sr_login", label: "SR Login", desc: "Auth/login module" },
  { id: "helpdesk", label: "Helpdesk", desc: "Support system" },
];

export default function KBUpdatesPage() {
  const [pendingEvents, setPendingEvents] = useState<KBUpdateEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<KBUpdateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [pending, recent] = await Promise.all([
        marsRequest<{ data: KBUpdateEvent[] }>("/kb-updates/pending"),
        marsRequest<{ data: KBUpdateEvent[] }>("/kb-updates"),
      ]);
      setPendingEvents(pending.data || []);
      setRecentEvents((recent.data || []).filter((e) => e.status !== "pending"));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch KB updates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    setActionInFlight((prev) => ({ ...prev, [id]: true }));
    try {
      await marsRequest(`/kb-updates/${id}/approve`, "POST");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionInFlight((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSkip = async (id: string) => {
    setActionInFlight((prev) => ({ ...prev, [id]: true }));
    try {
      await marsRequest(`/kb-updates/${id}/skip`, "POST");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skip failed");
    } finally {
      setActionInFlight((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSync = async (repoId: string) => {
    setSyncingRepo(repoId);
    setSyncResult((prev) => ({ ...prev, [repoId]: "" }));
    try {
      const result = await marsRequest<{ data: { message?: string; changed_files?: number; event_id?: string } }>(
        `/kb-updates/sync`, "POST", { repo_id: repoId }
      );
      const data = result?.data || result;
      const msg = (data as Record<string, unknown>).message || (data as Record<string, unknown>).changed_files
        ? `${(data as Record<string, unknown>).changed_files || 0} files changed`
        : "Synced";
      setSyncResult((prev) => ({ ...prev, [repoId]: String(msg) }));
      await fetchData();
    } catch (err) {
      setSyncResult((prev) => ({
        ...prev,
        [repoId]: err instanceof Error ? err.message : "Sync failed",
      }));
    } finally {
      setSyncingRepo(null);
    }
  };

  const handleSyncAll = async () => {
    for (const repo of SYNC_REPOS) {
      await handleSync(repo.id);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar activePage="admin-kb-updates" />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">KB Updates</h1>
                <p className="text-xs text-slate-500">
                  Review and approve knowledge base updates from code changes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Repo Sync */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-medium text-white">Sync Repositories</h2>
              </div>
              <button
                onClick={handleSyncAll}
                disabled={syncingRepo !== null}
                className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 disabled:opacity-50 transition-colors"
              >
                Sync All
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SYNC_REPOS.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleSync(repo.id)}
                  disabled={syncingRepo !== null}
                  className="flex flex-col items-start p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-sky-500/20 disabled:opacity-50 transition-all text-left"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-medium text-white truncate">{repo.label}</span>
                    {syncingRepo === repo.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                    ) : syncResult[repo.id] ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate w-full">{repo.desc}</span>
                  {syncResult[repo.id] && (
                    <span className="text-[10px] text-sky-400 mt-1 truncate w-full">{syncResult[repo.id]}</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Pending Events */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium text-white">
                Pending Approval
              </h2>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                {pendingEvents.length}
              </span>
            </div>

            {loading && pendingEvents.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading pending events...
              </div>
            ) : pendingEvents.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <CheckCircle className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                <p className="text-sm text-slate-500">All caught up. No pending KB updates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GitBranch className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">
                            {event.repo}
                          </span>
                          <StatusBadge status={event.status} />
                          <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                            {timeAgo(event.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                          {event.commit_message}
                        </p>

                        {/* Meta Pills */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {event.affected_modules.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              <BookOpen className="w-3 h-3" />
                              {event.affected_modules.length} module{event.affected_modules.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {event.affected_pillars.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {event.affected_pillars.join(", ")}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            ~{event.estimated_retrain_docs} docs to retrain
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(event.id)}
                            disabled={actionInFlight[event.id]}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            {actionInFlight[event.id] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Approve & Train
                          </button>
                          <button
                            onClick={() => handleSkip(event.id)}
                            disabled={actionInFlight[event.id]}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border border-slate-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Skip
                          </button>
                          <button
                            onClick={() => toggleExpand(event.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                            {expandedId === event.id ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === event.id && (
                      <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.01]">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 block mb-1">Commit SHA</span>
                            <code className="text-slate-300 font-mono bg-white/[0.04] px-2 py-0.5 rounded">
                              {event.commit_sha?.slice(0, 12) || "N/A"}
                            </code>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-1">Created</span>
                            <span className="text-slate-300">
                              {new Date(event.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-1">Affected Modules</span>
                            <div className="flex flex-wrap gap-1">
                              {event.affected_modules.length > 0 ? (
                                event.affected_modules.map((m) => (
                                  <span key={m} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    {m}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic">None detected</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-1">Affected Pillars</span>
                            <div className="flex flex-wrap gap-1">
                              {event.affected_pillars.length > 0 ? (
                                event.affected_pillars.map((p) => (
                                  <span key={p} className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic">None detected</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-medium text-white">Recent Activity</h2>
            </div>

            {recentEvents.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm text-slate-500">No recent activity yet.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
                {recentEvents.map((event) => (
                  <div key={event.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white truncate">{event.repo}</span>
                        <StatusBadge status={event.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {event.commit_message}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs text-slate-500 block">
                        {event.affected_modules.length} module{event.affected_modules.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-slate-600">
                        {timeAgo(event.trained_at || event.approved_at || event.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
