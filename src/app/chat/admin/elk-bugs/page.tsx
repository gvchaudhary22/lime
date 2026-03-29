"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  ExternalLink,
  UserPlus,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Brain,
  GitPullRequest,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/lib/api";
import type { ELKBug } from "@/lib/api";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", label: "Open" },
  assigned: { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "Assigned" },
  pr_generated: { color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", label: "PR Generated" },
  pr_merged: { color: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/30", label: "PR Merged" },
  resolved: { color: "text-green-400", bg: "bg-green-500/20 border-green-500/30", label: "Resolved" },
  ignored: { color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30", label: "Ignored" },
};

export default function ELKBugsPage() {
  const router = useRouter();
  const [bugs, setBugs] = useState<ELKBug[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRepoId, setFilterRepoId] = useState("");
  const [categoryTab, setCategoryTab] = useState<"all" | "code_bug" | "workflow_issue">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Scan options
  const [elkUrl, setElkUrl] = useState("");
  const [selectedIndexId, setSelectedIndexId] = useState("");
  const [elkIndexes, setElkIndexes] = useState<{ id: string; index_pattern: string; data_view_id: string; label: string; category: string }[]>([]);
  const [showScanPanel, setShowScanPanel] = useState(false);

  // Scan status from backend
  const [scanStatus, setScanStatus] = useState<{ total_bugs: number; last_scan_at: string | null } | null>(null);

  // Inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPRURL, setEditPRURL] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  // Manager review
  const [pendingReviews, setPendingReviews] = useState<ELKBug[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bugsRes, reviewRes, indexRes, statusRes] = await Promise.all([
        api.listELKBugs(filterRepoId || undefined),
        api.listELKBugPendingReviews(),
        api.listELKIndexes(),
        api.getELKBugScanStatus(),
      ]);
      if (bugsRes.success && bugsRes.data) setBugs(bugsRes.data);
      if (reviewRes.success && reviewRes.data) setPendingReviews(reviewRes.data);
      if (indexRes.success && indexRes.data) setElkIndexes(indexRes.data);
      if (statusRes.success && statusRes.data) {
        setScanStatus({ total_bugs: statusRes.data.total_bugs, last_scan_at: statusRes.data.last_scan_at });
        setScanning(statusRes.data.running);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterRepoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Parse ELK Discover URL to extract dataViewId and query
  const parseElkUrl = (url: string): { dataViewId: string; query: string } | null => {
    try {
      // Extract dataViewId from URL: dataViewId:'xxxx' or dataViewId:xxxx
      const dvMatch = url.match(/dataViewId[:']*([a-f0-9-]+)/);
      // Extract query from URL: query:%22xxx%22 or query:'xxx'
      const qMatch = url.match(/query[,:](?:%22|'|")([^%'"]+)/);
      if (dvMatch) {
        return {
          dataViewId: dvMatch[1],
          query: qMatch ? decodeURIComponent(qMatch[1]) : "",
        };
      }
    } catch { /* ignore parse errors */ }
    return null;
  };

  const triggerScan = async () => {
    setScanning(true);
    try {
      let params: { index_id?: string; search_query?: string } = {};

      if (elkUrl.trim()) {
        // Parse ELK URL to extract dataViewId and query
        const parsed = parseElkUrl(elkUrl.trim());
        if (parsed) {
          // Find matching index by data_view_id
          const matchedIndex = elkIndexes.find(idx => idx.data_view_id === parsed.dataViewId);
          if (matchedIndex) {
            params.index_id = matchedIndex.id;
            if (parsed.query) params.search_query = parsed.query;
          }
        }
      } else if (selectedIndexId) {
        params.index_id = selectedIndexId;
      }

      await api.triggerELKBugScan(Object.keys(params).length > 0 ? params : undefined);
      setTimeout(() => { loadData(); setElkUrl(""); }, 5000);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setScanning(false), 3000);
    }
  };

  const updateStatus = async (bugId: string, status: string) => {
    try {
      await api.updateELKBug(bugId, { status });
      loadData();
    } catch {
      // ignore
    }
  };

  const submitPR = async (bugId: string) => {
    if (!editPRURL.trim()) return;
    try {
      await api.updateELKBug(bugId, { status: "pr_generated", pr_url: editPRURL.trim() });
      setEditingId(null);
      setEditPRURL("");
      loadData();
    } catch {
      // ignore
    }
  };

  const assignBug = async (bugId: string) => {
    if (!editAssignedTo.trim()) return;
    try {
      await api.updateELKBug(bugId, { status: "assigned", assigned_to: editAssignedTo.trim() });
      setEditingId(null);
      setEditAssignedTo("");
      loadData();
    } catch {
      // ignore
    }
  };

  const submitReview = async (bugId: string, action: "approve" | "reject") => {
    try {
      await api.submitELKBugReview(bugId, action, reviewComment);
      setReviewingId(null);
      setReviewComment("");
      loadData();
    } catch { /* ignore */ }
  };

  // Unique repo IDs for filter dropdown
  const repoIds = Array.from(new Set(bugs.map((b) => b.repository_id)));

  // Filtered bugs
  const filteredBugs = bugs
    .filter((b) => {
      if (filterStatus && b.status !== filterStatus) return false;
      if (categoryTab !== "all" && b.bug_category !== categoryTab) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at || b.last_seen_at || "").getTime() - new Date(a.created_at || a.last_seen_at || "").getTime());

  const totalPages = Math.ceil(filteredBugs.length / pageSize);
  const paginatedBugs = filteredBugs.slice((page - 1) * pageSize, page * pageSize);

  // Stats
  const stats = {
    open: bugs.filter((b) => b.status === "open").length,
    assigned: bugs.filter((b) => b.status === "assigned").length,
    pr_generated: bugs.filter((b) => b.status === "pr_generated" || b.status === "pr_merged").length,
    resolved: bugs.filter((b) => b.status === "resolved").length,
    pending_review: pendingReviews.length,
    ai_analyzed: bugs.filter((b) => b.analysis_status === "completed").length,
  };

  const parseCompanies = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bug className="w-6 h-6 text-orange-400" />
              <h1 className="text-2xl font-bold text-white">ELK Bug Scanner</h1>
              {scanning && (
                <span className="flex items-center gap-1.5 text-sm text-orange-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scan running...
                </span>
              )}
              {!scanning && <span className="text-sm text-zinc-500">Automated error detection from ELK logs</span>}
            </div>
            <button
              onClick={() => setShowScanPanel(!showScanPanel)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              Scan Now
              <ChevronDown className={`w-3 h-3 transition ${showScanPanel ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Scan Panel */}
          {showScanPanel && (
            <div className="bg-zinc-900/60 border border-orange-500/20 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-orange-300 mb-2">Scan Configuration</div>

              {/* Option 1: Paste ELK URL */}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Paste ELK Discover URL</label>
                <input
                  value={elkUrl}
                  onChange={e => { setElkUrl(e.target.value); setSelectedIndexId(""); }}
                  placeholder="https://elk-01.shiprocket.in/app/discover#/?..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                {elkUrl && (() => {
                  const parsed = parseElkUrl(elkUrl);
                  if (parsed) {
                    const matched = elkIndexes.find(idx => idx.data_view_id === parsed.dataViewId);
                    return (
                      <div className="mt-1 text-xs">
                        {matched ? (
                          <span className="text-green-400">✓ Matched: {matched.label} ({matched.index_pattern})</span>
                        ) : (
                          <span className="text-yellow-400">⚠ dataViewId {parsed.dataViewId} not mapped to any index</span>
                        )}
                        {parsed.query && <span className="text-zinc-500 ml-2">Query: &quot;{parsed.query}&quot;</span>}
                      </div>
                    );
                  }
                  return <div className="mt-1 text-xs text-red-400">Could not parse URL</div>;
                })()}
              </div>

              {/* Option 2: Select Index */}
              {!elkUrl && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Or select an index</label>
                  <select
                    value={selectedIndexId}
                    onChange={e => setSelectedIndexId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All indexes (full scan)</option>
                    {elkIndexes.map(idx => (
                      <option key={idx.id} value={idx.id}>
                        [{idx.category}] {idx.label} — {idx.index_pattern}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Scan Button + Analyze All */}
              <div className="flex items-center gap-3">
                <button
                  onClick={triggerScan}
                  disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded transition disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {scanning ? "Scanning..." : elkUrl ? "Scan from URL" : selectedIndexId ? "Scan Selected Index" : "Scan All"}
                </button>
                <button
                  onClick={async () => { await api.analyzeAllELKBugs(); setTimeout(() => loadData(), 10000); }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition"
                >
                  <Brain className="w-4 h-4" />
                  Analyze All Pending
                </button>
                <button
                  onClick={async () => { await api.generateAllELKBugFixes(); setTimeout(() => loadData(), 15000); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition"
                >
                  <GitPullRequest className="w-4 h-4" />
                  Generate PRs for Analyzed
                </button>
                <button
                  onClick={async () => { await api.stopELKBugScan(); loadData(); }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-sm rounded transition"
                >
                  <XCircle className="w-4 h-4" />
                  Stop Scan
                </button>
              </div>
            </div>
          )}

          {/* Stats Bar — clickable to filter */}
          <div className="grid grid-cols-7 gap-3">
            <button onClick={() => { setFilterStatus(""); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${!filterStatus && categoryTab === "all" ? "ring-2 ring-cyan-400 scale-[1.02]" : ""} bg-cyan-500/10 border-cyan-500/20`}>
              <div className="text-2xl font-bold text-cyan-400">{scanStatus?.total_bugs ?? bugs.length}</div>
              <div className="text-xs text-cyan-300/70">Total Bugs</div>
              {scanStatus?.last_scan_at && (
                <div className="text-[9px] text-zinc-500 mt-1">Last: {new Date(scanStatus.last_scan_at).toLocaleDateString()}</div>
              )}
            </button>
            <button onClick={() => { setFilterStatus(filterStatus === "open" ? "" : "open"); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${filterStatus === "open" ? "ring-2 ring-red-400 scale-[1.02]" : ""} bg-red-500/10 border-red-500/20`}>
              <div className="text-2xl font-bold text-red-400">{stats.open}</div>
              <div className="text-xs text-red-300/70">Open</div>
            </button>
            <button onClick={() => { setFilterStatus(filterStatus === "assigned" ? "" : "assigned"); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${filterStatus === "assigned" ? "ring-2 ring-yellow-400 scale-[1.02]" : ""} bg-yellow-500/10 border-yellow-500/20`}>
              <div className="text-2xl font-bold text-yellow-400">{stats.assigned}</div>
              <div className="text-xs text-yellow-300/70">Assigned</div>
            </button>
            <button onClick={() => { setFilterStatus(filterStatus === "pr_generated" ? "" : "pr_generated"); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${filterStatus === "pr_generated" ? "ring-2 ring-blue-400 scale-[1.02]" : ""} bg-blue-500/10 border-blue-500/20`}>
              <div className="text-2xl font-bold text-blue-400">{stats.pr_generated}</div>
              <div className="text-xs text-blue-300/70">With PR</div>
            </button>
            <button onClick={() => { setFilterStatus(filterStatus === "resolved" ? "" : "resolved"); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${filterStatus === "resolved" ? "ring-2 ring-green-400 scale-[1.02]" : ""} bg-green-500/10 border-green-500/20`}>
              <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
              <div className="text-xs text-green-300/70">Resolved</div>
            </button>
            <button onClick={() => { setFilterStatus(""); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer ${stats.pending_review > 0 ? "bg-orange-500/10 border-orange-500/20" : "bg-zinc-800/50 border-zinc-700"}`}>
              <div className={`text-2xl font-bold ${stats.pending_review > 0 ? "text-orange-400" : "text-zinc-500"}`}>{stats.pending_review}</div>
              <div className={`text-xs ${stats.pending_review > 0 ? "text-orange-300/70" : "text-zinc-500"}`}>Pending Review</div>
            </button>
            <button onClick={() => { setFilterStatus(""); setCategoryTab("all"); setPage(1); }} className={`border rounded-lg p-4 text-center transition hover:opacity-80 cursor-pointer bg-purple-500/10 border-purple-500/20`}>
              <div className="text-2xl font-bold text-purple-400">{stats.ai_analyzed}</div>
              <div className="text-xs text-purple-300/70">AI Analyzed</div>
            </button>
          </div>

          {/* Manager Review Section */}
          {pendingReviews.length > 0 && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-orange-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Manager Review Required ({pendingReviews.length})
              </h3>
              <div className="space-y-2">
                {pendingReviews.map((bug) => (
                  <div key={bug.id} className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-white font-medium truncate">{bug.error_message}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{bug.error_type} • {bug.occurrence_count} occurrences</p>
                      </div>
                      {bug.pr_url && (
                        <a href={bug.pr_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 ml-2">
                          <ExternalLink className="w-3 h-3" /> PR
                        </a>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => router.push(`/chat/admin/elk-bugs/${bug.id}/analysis`)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> View Analysis
                      </button>
                      {reviewingId === bug.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Comment (optional)" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-white w-40" />
                          <button onClick={() => submitReview(bug.id, "approve")} className="px-2 py-1 bg-green-600/30 border border-green-500/30 rounded text-[10px] text-green-300 hover:bg-green-600/40">Approve</button>
                          <button onClick={() => submitReview(bug.id, "reject")} className="px-2 py-1 bg-red-600/30 border border-red-500/30 rounded text-[10px] text-red-300 hover:bg-red-600/40">Reject</button>
                          <button onClick={() => setReviewingId(null)} className="text-[10px] text-zinc-500">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(bug.id)} className="px-2 py-1 bg-orange-600/20 border border-orange-500/30 rounded text-[10px] text-orange-300 hover:bg-orange-600/30">Review</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
            {[
              { key: "all" as const, label: "All Bugs", count: bugs.length },
              { key: "code_bug" as const, label: "Code Bugs", count: bugs.filter(b => b.bug_category === "code_bug").length },
              { key: "workflow_issue" as const, label: "Workflow Issues", count: bugs.filter(b => b.bug_category === "workflow_issue").length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setCategoryTab(tab.key); setFilterStatus(""); setPage(1); }}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
                  categoryTab === tab.key
                    ? tab.key === "code_bug" ? "bg-red-600/20 text-red-300 border border-red-500/30"
                    : tab.key === "workflow_issue" ? "bg-amber-600/20 text-amber-300 border border-amber-500/30"
                    : "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  categoryTab === tab.key ? "bg-white/10" : "bg-zinc-800"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={filterRepoId}
              onChange={(e) => { setFilterRepoId(e.target.value); setPage(1); }}
              className="bg-zinc-800 text-zinc-300 text-sm rounded px-3 py-1.5 border border-zinc-700"
            >
              <option value="">All Repositories</option>
              {repoIds.map((id) => (
                <option key={id} value={id}>{id.substring(0, 8)}...</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-zinc-800 text-zinc-300 text-sm rounded px-3 py-1.5 border border-zinc-700"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="pr_generated">PR Generated</option>
              <option value="pr_merged">PR Merged</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
            <span className="text-xs text-zinc-500 ml-auto">{filteredBugs.length} bugs</span>
          </div>

          {/* Bug List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : filteredBugs.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <Bug className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No ELK bugs found. Click &quot;Scan Now&quot; to start scanning.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedBugs.map((bug) => {
                const cfg = statusConfig[bug.status] || statusConfig.open;
                const isExpanded = expandedId === bug.id;
                const companies = parseCompanies(bug.affected_companies);

                return (
                  <div key={bug.id} className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden">
                    {/* Bug Header */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-800/30 transition"
                      onClick={() => setExpandedId(isExpanded ? null : bug.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                      )}
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">{bug.error_message}</div>
                        {bug.error_type && bug.error_type !== bug.error_message && (
                          <div className="text-xs text-zinc-400 truncate mt-0.5">{bug.error_type}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full font-mono">
                          {bug.occurrence_count}x
                        </span>
                        {bug.severity && (
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            bug.severity === "critical" ? "bg-red-600/30 text-red-300 border border-red-500/30" :
                            bug.severity === "high" ? "bg-orange-600/30 text-orange-300 border border-orange-500/30" :
                            bug.severity === "medium" ? "bg-yellow-600/30 text-yellow-300 border border-yellow-500/30" :
                            "bg-zinc-600/30 text-zinc-300 border border-zinc-500/30"
                          }`}>{bug.severity}</span>
                        )}
                        {bug.analysis_status === "completed" && (
                          <span className="px-1.5 py-0.5 bg-green-600/20 text-green-400 text-[10px] rounded">AI</span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {bug.pr_url && (
                          <a
                            href={bug.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-zinc-500">Index Pattern:</span>
                            <span className="ml-2 text-zinc-300 font-mono text-xs">{bug.index_pattern}</span>
                          </div>
                          {bug.source_file && (
                            <div>
                              <span className="text-zinc-500">Source:</span>
                              <span className="ml-2 text-zinc-300 font-mono text-xs">
                                {bug.source_file}{bug.source_line > 0 ? `:${bug.source_line}` : ""}
                              </span>
                            </div>
                          )}
                          {bug.sample_log_id && (
                            <div>
                              <span className="text-zinc-500">Sample Log ID:</span>
                              <a
                                href={`/chat/admin/elk-logs?log_id=${bug.sample_log_id}&index=${encodeURIComponent(bug.index_pattern)}`}
                                className="ml-2 text-blue-400 hover:text-blue-300 font-mono text-xs underline"
                              >
                                {bug.sample_log_id}
                              </a>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500">Last Seen:</span>
                            <span className="ml-2 text-zinc-300 text-xs">
                              {bug.last_seen_at ? new Date(bug.last_seen_at).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>

                        {companies.length > 0 && (
                          <div>
                            <span className="text-zinc-500 text-sm">Affected Companies:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {companies.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {bug.sample_log && (
                          <div>
                            <span className="text-zinc-500 text-sm">Sample Log:</span>
                            <pre className="mt-1 bg-black/50 border border-zinc-800 rounded p-3 text-xs text-zinc-400 overflow-x-auto max-h-40">
                              {bug.sample_log}
                            </pre>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                          {/* AI Analysis — available for all statuses except resolved/ignored */}
                          {bug.status !== "resolved" && bug.status !== "ignored" && (
                            <button
                              onClick={() => router.push(`/chat/admin/elk-bugs/${bug.id}/analysis`)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded border border-purple-600/30 transition"
                            >
                              <Brain className="w-3 h-3" /> AI Analysis
                            </button>
                          )}
                          {bug.status === "open" && (
                            <>
                              <button
                                onClick={() => { setEditingId(bug.id); setEditAssignedTo(""); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 text-xs rounded border border-yellow-600/30 transition"
                              >
                                <UserPlus className="w-3 h-3" /> Assign
                              </button>
                              <button
                                onClick={() => { setEditingId(bug.id); setEditPRURL(""); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-600/30 transition"
                              >
                                <ExternalLink className="w-3 h-3" /> Add PR
                              </button>
                              <button
                                onClick={() => updateStatus(bug.id, "ignored")}
                                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600/20 hover:bg-zinc-600/30 text-zinc-300 text-xs rounded border border-zinc-600/30 transition"
                              >
                                <EyeOff className="w-3 h-3" /> Ignore
                              </button>
                            </>
                          )}
                          {(bug.status === "assigned" || bug.status === "pr_generated" || bug.status === "pr_merged") && (
                            <button
                              onClick={() => updateStatus(bug.id, "resolved")}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs rounded border border-green-600/30 transition"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Resolve
                            </button>
                          )}
                          {bug.status === "ignored" && (
                            <button
                              onClick={() => updateStatus(bug.id, "open")}
                              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600/20 hover:bg-zinc-600/30 text-zinc-300 text-xs rounded border border-zinc-600/30 transition"
                            >
                              <Eye className="w-3 h-3" /> Reopen
                            </button>
                          )}
                          {bug.status === "resolved" && (
                            <span className="text-xs text-green-400/60">
                              Resolved {bug.resolved_at ? new Date(bug.resolved_at).toLocaleDateString() : ""}
                            </span>
                          )}
                        </div>

                        {/* Inline Assign Form */}
                        {editingId === bug.id && !editPRURL && editAssignedTo !== undefined && bug.status === "open" && (
                          <div className="flex items-center gap-2 bg-zinc-800/50 rounded p-2">
                            <input
                              type="text"
                              placeholder="Assign to (user ID or email)"
                              value={editAssignedTo}
                              onChange={(e) => setEditAssignedTo(e.target.value)}
                              className="flex-1 bg-zinc-900 text-zinc-300 text-sm rounded px-3 py-1.5 border border-zinc-700"
                            />
                            <button
                              onClick={() => assignBug(bug.id)}
                              className="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs rounded hover:bg-zinc-600 transition"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Inline PR URL Form */}
                        {editingId === bug.id && editPRURL !== undefined && bug.status === "open" && (
                          <div className="flex items-center gap-2 bg-zinc-800/50 rounded p-2">
                            <input
                              type="text"
                              placeholder="https://github.com/org/repo/pull/123"
                              value={editPRURL}
                              onChange={(e) => setEditPRURL(e.target.value)}
                              className="flex-1 bg-zinc-900 text-zinc-300 text-sm rounded px-3 py-1.5 border border-zinc-700"
                            />
                            <button
                              onClick={() => submitPR(bug.id)}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                            >
                              Save PR
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs rounded hover:bg-zinc-600 transition"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 disabled:opacity-30 transition"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-xs font-medium transition ${
                    p === page
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                      : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 disabled:opacity-30 transition"
              >
                Next
              </button>
              <span className="text-xs text-zinc-500 ml-2">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredBugs.length)} of {filteredBugs.length}
              </span>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center text-xs text-zinc-600 py-4 border-t border-zinc-800/50">
            ELK retains 7 days only. Bugs are scanned from last 24h of logs.
            Errors with existing PRs (pr_generated/pr_merged/resolved/ignored) are skipped during scan.
          </div>
        </div>
      </main>
    </div>
  );
}
