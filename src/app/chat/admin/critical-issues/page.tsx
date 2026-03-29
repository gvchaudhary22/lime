"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  Filter,
  BarChart3,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/lib/api";
import type { CriticalIssue, CriticalIssueStats } from "@/lib/api";

const severityConfig: Record<string, { color: string; bg: string; icon: typeof ShieldAlert }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", icon: ShieldAlert },
  high: { color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30", icon: AlertTriangle },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", icon: AlertCircle },
  low: { color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", icon: Info },
};

const statusColors: Record<string, string> = {
  open: "bg-red-500/20 text-red-300 border-red-500/30",
  assigned: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-300 border-green-500/30",
  wontfix: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

export default function CriticalIssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<CriticalIssue[]>([]);
  const [stats, setStats] = useState<CriticalIssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");

  // Filters
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRepoId, setFilterRepoId] = useState("");

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
      const [issuesRes, statsRes] = await Promise.all([
        api.listCriticalIssues({
          severity: filterSeverity || undefined,
          status: filterStatus || undefined,
          repo_id: filterRepoId || undefined,
        }),
        api.getCriticalIssueStats(),
      ]);
      if (issuesRes.success && issuesRes.data) setIssues(issuesRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus, filterRepoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await api.triggerVulnerabilityScan();
      // Poll after a delay for results
      setTimeout(() => loadData(), 5000);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setScanning(false), 3000);
    }
  };

  const handleAssign = async (issueId: string) => {
    if (!assignEmail.trim()) return;
    try {
      await api.assignCriticalIssue(issueId, assignEmail.trim());
      setAssigningId(null);
      setAssignEmail("");
      loadData();
    } catch {
      // ignore
    }
  };

  const handleResolve = async (issueId: string, resolution: string) => {
    try {
      await api.resolveCriticalIssue(issueId, resolution);
      loadData();
    } catch {
      // ignore
    }
  };

  // Unique repo IDs for filter dropdown
  const repoIds = Array.from(new Set(issues.map((i) => i.repository_id)));

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-400" />
                Critical Issues Scanner
              </h1>
              <p className="text-gray-400 mt-1">
                Vulnerability and code quality scanner for onboarded repositories
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-[#1a1a2e] border border-gray-700 rounded-lg text-gray-300 hover:bg-[#252540] flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={triggerScan}
                disabled={scanning}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                {scanning ? "Scanning..." : "Run Scan"}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <BarChart3 className="w-4 h-4" /> Total Open
                </div>
                <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
              </div>
              {["critical", "high", "medium", "low"].map((sev) => {
                const cfg = severityConfig[sev];
                const Icon = cfg.icon;
                return (
                  <div
                    key={sev}
                    className={`border rounded-lg p-4 ${cfg.bg}`}
                  >
                    <div className={`flex items-center gap-2 text-sm ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                      {sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {stats.by_severity[sev] || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="wontfix">Won&apos;t Fix</option>
            </select>
            {repoIds.length > 0 && (
              <select
                value={filterRepoId}
                onChange={(e) => setFilterRepoId(e.target.value)}
                className="bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm max-w-[200px]"
              >
                <option value="">All Repos</option>
                {repoIds.map((id) => (
                  <option key={id} value={id}>
                    {id.substring(0, 8)}...
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Issue List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No critical issues found. Run a scan to check your repositories.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => {
                const sevCfg = severityConfig[issue.severity] || severityConfig.medium;
                const SevIcon = sevCfg.icon;
                const isExpanded = expandedId === issue.id;

                return (
                  <div
                    key={issue.id}
                    className="bg-[#1a1a2e] border border-gray-800 rounded-lg overflow-hidden"
                  >
                    {/* Issue row */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#252540]"
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                      <SevIcon className={`w-4 h-4 flex-shrink-0 ${sevCfg.color}`} />
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${sevCfg.bg} ${sevCfg.color}`}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-gray-200 text-sm flex-1 truncate">{issue.title}</span>
                      <span className="text-gray-500 text-xs font-mono">{issue.issue_type}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${
                          statusColors[issue.status] || statusColors.open
                        }`}
                      >
                        {issue.status}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-800 p-4 space-y-3 bg-[#12121f]">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Repository:</span>{" "}
                            <span className="text-gray-300 font-mono text-xs">
                              {issue.repository_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Module:</span>{" "}
                            <span className="text-gray-300">{issue.module_path}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">File:</span>{" "}
                            <span className="text-gray-300 font-mono text-xs">
                              {issue.file_path}:{issue.line_number}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Found:</span>{" "}
                            <span className="text-gray-300">
                              {new Date(issue.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-500 text-sm">Description:</span>
                          <p className="text-gray-300 text-sm mt-1">{issue.description}</p>
                        </div>

                        {issue.evidence && (
                          <div>
                            <span className="text-gray-500 text-sm">Evidence:</span>
                            <pre className="mt-1 p-3 bg-[#0a0a15] rounded text-xs text-gray-300 font-mono overflow-x-auto border border-gray-800">
                              {issue.evidence}
                            </pre>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {issue.status === "open" && (
                            <>
                              {assigningId === issue.id ? (
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    placeholder="User ID to assign"
                                    value={assignEmail}
                                    onChange={(e) => setAssignEmail(e.target.value)}
                                    className="bg-[#0a0a15] border border-gray-700 rounded px-3 py-1 text-sm text-gray-300 w-64"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAssign(issue.id);
                                    }}
                                    className="px-3 py-1 bg-blue-600 rounded text-white text-sm"
                                  >
                                    Assign
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssigningId(null);
                                    }}
                                    className="px-3 py-1 bg-gray-700 rounded text-gray-300 text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssigningId(issue.id);
                                  }}
                                  className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-blue-300 text-sm flex items-center gap-1"
                                >
                                  <UserPlus className="w-3 h-3" /> Assign
                                </button>
                              )}
                            </>
                          )}
                          {issue.status !== "resolved" && issue.status !== "wontfix" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(issue.id, "resolved");
                                }}
                                className="px-3 py-1 bg-green-600/20 border border-green-500/30 rounded text-green-300 text-sm flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Resolve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(issue.id, "wontfix");
                                }}
                                className="px-3 py-1 bg-gray-600/20 border border-gray-500/30 rounded text-gray-300 text-sm"
                              >
                                Won&apos;t Fix
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
