"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronRight,
  Activity,
  GitBranch,
  Flag,
  Terminal,
  ChevronDown,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/lib/api";

interface RunSummary {
  run_id: string;
  total_tests: number;
  passed: number;
  failed: number;
  total_duration_ms: number;
  total_records_created: number;
  repo_id: string;
  trigger_source: string;
  created_at: string;
}

interface ReportDetail {
  id: string;
  run_id: string;
  test_name: string;
  status: string;
  intent: string;
  request_summary: string;
  response_summary: string;
  duration_ms: number;
  records_created: number;
  error_message: string;
  repo_id: string;
  repo_url: string;
  trigger_source: string;
  request_method: string;
  request_path: string;
  request_headers: string;
  response_body: string;
  response_status_code: number;
  is_dry_run: boolean;
  created_at: string;
}

interface Repository {
  id: string;
  name: string;
  git_url: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem("mars_token")}`,
    "Content-Type": "application/json",
  };
}

export default function DryRunPanel() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<ReportDetail[]>([]);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Repo selection
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [singleFileMode, setSingleFileMode] = useState(true);

  // Module approvals
  interface PendingApproval {
    repo_id: string;
    module_path: string;
    module_name: string;
    score: number;
    submitted_by: string;
  }
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvingModule, setApprovingModule] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchRuns();
    fetchPendingApprovals();
    fetchRepos();
  }, [router]);

  const fetchRepos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/repositories`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRepos(data.data);
      }
    } catch { /* ignore */ }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/modules/pending`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data) setPendingApprovals(data.data || []);
    } catch { /* ignore */ }
  };

  const approveModule = async (repoId: string, modulePath: string) => {
    setApprovingModule(modulePath);
    try {
      await fetch(`${API_BASE}/api/v1/admin/modules/approve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ repository_id: repoId, module_path: modulePath }),
      });
      fetchPendingApprovals();
    } catch { /* ignore */ }
    setApprovingModule(null);
  };

  const rejectModule = async (repoId: string, modulePath: string) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    setApprovingModule(modulePath);
    try {
      await fetch(`${API_BASE}/api/v1/admin/modules/reject`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ repository_id: repoId, module_path: modulePath, reason }),
      });
      fetchPendingApprovals();
    } catch { /* ignore */ }
    setApprovingModule(null);
  };

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/dryrun/reports`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data) setRuns(data.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchRunDetails = async (runId: string) => {
    setSelectedRun(runId);
    setExpandedDetail(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/dryrun/reports/${runId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data) setRunDetails(data.data);
    } catch {
      setRunDetails([]);
    }
  };

  const triggerDryRun = async () => {
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/api/v1/admin/dryrun/trigger`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          repo_id: selectedRepo || undefined,
          single_file_mode: singleFileMode,
        }),
      });
      setTimeout(() => { fetchRuns(); setTriggering(false); }, 5000);
    } catch {
      setTriggering(false);
    }
  };

  const cleanup = async () => {
    if (!confirm("This will delete ALL records with is_dry_run=1 from key tables. Continue?")) return;
    setCleaning(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/dryrun/cleanup`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) alert(`Cleaned ${data.data?.records_deleted || 0} dry run records.`);
    } catch { /* ignore */ }
    setCleaning(false);
  };

  const timeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const parsedHeaders = (raw: string): Record<string, string> => {
    try { return JSON.parse(raw); } catch { return {}; }
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="admin" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">Dry Run Testing</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cleanup}
                disabled={cleaning}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {cleaning ? "Cleaning..." : "Cleanup All Dry Data"}
              </button>
              <button
                onClick={fetchRuns}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            End-to-end tests with real DB writes + mocked AI. Records created during dry run have{" "}
            <code className="text-purple-400 text-xs">is_dry_run=1</code>.
          </p>
        </div>

        {/* Trigger Controls */}
        <div className="px-8 pb-5">
          <div className="flex items-end gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {/* Repo selector */}
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" /> Target Repository (optional)
              </label>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-3 py-2 text-sm text-white bg-white/[0.05] border border-white/[0.08] rounded-lg focus:outline-none focus:border-purple-500/50"
              >
                <option value="">All repos (full pipeline)</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Single file mode toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> Single File Mode
              </label>
              <button
                onClick={() => setSingleFileMode(!singleFileMode)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  singleFileMode
                    ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                    : "bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                }`}
              >
                {singleFileMode ? "ON — 1 file only" : "OFF — full pipeline"}
              </button>
            </div>

            {/* Run button */}
            <button
              onClick={triggerDryRun}
              disabled={triggering}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {triggering ? "Running..." : "Run Now"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Pending Module Approvals */}
          {pendingApprovals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Pending Module Approvals ({pendingApprovals.length})
              </h2>
              <div className="space-y-2">
                {pendingApprovals.map((pa) => (
                  <div key={pa.module_path} className="flex items-center justify-between px-4 py-3 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04]">
                    <div>
                      <span className="text-sm text-white font-medium">{pa.module_name}</span>
                      <span className="text-xs text-slate-400 ml-2">Score: {pa.score}/100</span>
                      {pa.submitted_by && <span className="text-xs text-slate-500 ml-2">by {pa.submitted_by}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveModule(pa.repo_id, pa.module_path)}
                        disabled={approvingModule === pa.module_path}
                        className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {approvingModule === pa.module_path ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => rejectModule(pa.repo_id, pa.module_path)}
                        disabled={approvingModule === pa.module_path}
                        className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p className="text-lg">No dry run reports yet</p>
              <p className="text-sm mt-1">Click "Run Now" to trigger a full dry run</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.run_id}>
                  <button
                    onClick={() =>
                      selectedRun === run.run_id ? setSelectedRun(null) : fetchRunDetails(run.run_id)
                    }
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                      selectedRun === run.run_id
                        ? "border-purple-500/40 bg-purple-500/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white font-mono">{run.run_id}</span>
                        <span className="text-xs text-slate-500">{timeAgo(run.created_at)}</span>
                        {/* is_dry_run flag badge */}
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20">
                          <Flag className="w-2.5 h-2.5" /> dry_run
                        </span>
                        {run.repo_id && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <GitBranch className="w-2.5 h-2.5" /> {run.repo_id}
                          </span>
                        )}
                        {run.trigger_source && (
                          <span className="text-xs text-slate-500 italic">{run.trigger_source}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-xs text-green-400">{run.passed} passed</span>
                        </div>
                        {run.failed > 0 && (
                          <div className="flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs text-red-400">{run.failed} failed</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {(run.total_duration_ms / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">{run.total_records_created} records</span>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-500 transition-transform ${
                            selectedRun === run.run_id ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${run.failed > 0 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${(run.passed / Math.max(run.total_tests, 1)) * 100}%` }}
                      />
                    </div>
                  </button>

                  {/* Run details — expanded table */}
                  {selectedRun === run.run_id && runDetails.length > 0 && (
                    <div className="ml-4 mt-2 space-y-1.5">
                      {runDetails.map((detail) => {
                        const isExpanded = expandedDetail === detail.id;
                        const headers = parsedHeaders(detail.request_headers);
                        const isPassed = detail.status === "passed" || detail.status === "pass";

                        return (
                          <div
                            key={detail.id}
                            className={`rounded-lg border ${
                              isPassed
                                ? "border-green-500/20 bg-green-500/[0.04]"
                                : "border-red-500/20 bg-red-500/[0.04]"
                            }`}
                          >
                            {/* Row header */}
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                {isPassed ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-white">{detail.test_name}</span>
                                    {/* is_dry_run flag */}
                                    {detail.is_dry_run && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/20 font-mono">
                                        is_dry_run=1
                                      </span>
                                    )}
                                    {detail.repo_id && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {detail.repo_id}
                                      </span>
                                    )}
                                    {detail.trigger_source && (
                                      <span className="text-[10px] text-slate-500 italic">
                                        via {detail.trigger_source}
                                      </span>
                                    )}
                                  </div>
                                  {detail.error_message && (
                                    <p className="text-xs text-red-400 mt-0.5">{detail.error_message}</p>
                                  )}
                                  {/* Request line */}
                                  {detail.request_method && detail.request_path && (
                                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      <span className="text-slate-400">{detail.request_method}</span>{" "}
                                      {detail.request_path}
                                      {detail.response_status_code > 0 && (
                                        <span
                                          className={`ml-2 ${
                                            detail.response_status_code < 400
                                              ? "text-green-400"
                                              : "text-red-400"
                                          }`}
                                        >
                                          {detail.response_status_code}
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">{detail.response_summary}</span>
                                <span className="text-xs text-slate-500">{detail.duration_ms}ms</span>
                                {(detail.request_headers || detail.response_body) && (
                                  <button
                                    onClick={() => setExpandedDetail(isExpanded ? null : detail.id)}
                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                  >
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                    Details
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expanded detail panel */}
                            {isExpanded && (
                              <div className="px-4 pb-3 border-t border-white/[0.04] space-y-3 pt-3">
                                {/* Request Headers */}
                                {Object.keys(headers).length > 0 && (
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                                      Request Headers
                                    </p>
                                    <div className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs space-y-1">
                                      {Object.entries(headers).map(([k, v]) => (
                                        <div key={k} className="flex gap-2">
                                          <span className="text-slate-400 shrink-0">{k}:</span>
                                          <span className="text-slate-300 break-all">{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Response Body */}
                                {detail.response_body && (
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                                      Response Body
                                    </p>
                                    <pre className="rounded-lg bg-black/30 px-3 py-2 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                                      {detail.response_body}
                                    </pre>
                                  </div>
                                )}

                                {/* Repo URL */}
                                {detail.repo_url && (
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                      Repository
                                    </p>
                                    <p className="text-xs text-blue-400 font-mono">{detail.repo_url}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
