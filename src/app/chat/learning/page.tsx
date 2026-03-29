"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  TrendingUp,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  LearningRecord,
  IncidentPattern,
  LearningProposal,
} from "@/lib/api";

type Tab = "records" | "patterns" | "proposals";

interface RepoOption {
  id: string;
  name: string;
}

export default function LearningPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("records");
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState(false);

  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [patterns, setPatterns] = useState<IncidentPattern[]>([]);
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchRepos();
  }, [router]);

  useEffect(() => {
    if (selectedRepo) {
      fetchTabData();
    }
  }, [selectedRepo, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRepos = async () => {
    // Fetch repositories from registry
    const res = await api.getProjects();
    if (res.success && res.data) {
      setRepos(res.data.map((p) => ({ id: p.id, name: p.name })));
      if (res.data.length > 0) {
        setSelectedRepo(res.data[0].id);
      }
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    if (tab === "records") {
      const res = await api.getLearningRecords(selectedRepo);
      if (res.success && res.data) setRecords(res.data);
    } else if (tab === "patterns") {
      const res = await api.getPatterns(selectedRepo);
      if (res.success && res.data) setPatterns(res.data);
    } else {
      const res = await api.getProposals(selectedRepo);
      if (res.success && res.data) setProposals(res.data);
    }
    setLoading(false);
  };

  const handleDetectPatterns = async () => {
    if (!selectedRepo) return;
    setDetecting(true);
    const res = await api.detectPatterns(selectedRepo);
    setDetecting(false);
    if (res.success) {
      fetchTabData();
    }
  };

  const handleVote = async (proposalId: string, direction: "up" | "down") => {
    await api.voteProposal(proposalId, direction);
    fetchTabData();
  };

  const handleUpdateStatus = async (proposalId: string, status: string) => {
    await api.updateProposalStatus(proposalId, status);
    fetchTabData();
  };

  const severityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "text-red-400 bg-red-500/10",
      high: "text-orange-400 bg-orange-500/10",
      medium: "text-yellow-400 bg-yellow-500/10",
      low: "text-green-400 bg-green-500/10",
    };
    return colors[severity] || "text-slate-400 bg-white/[0.05]";
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10",
      approved: "text-green-400 bg-green-500/10",
      rejected: "text-red-400 bg-red-500/10",
      applied: "text-blue-400 bg-blue-500/10",
    };
    return colors[status] || "text-slate-400 bg-white/[0.05]";
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="learning" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Learning</h1>
          </div>

          {/* Repo selector */}
          <div className="flex items-center gap-4 mb-4">
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="">Select a project</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {tab === "patterns" && (
              <button
                onClick={handleDetectPatterns}
                disabled={detecting || !selectedRepo}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {detecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Detect Patterns
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/[0.06]">
            {(
              [
                { id: "records" as Tab, label: "Records", icon: Brain },
                { id: "patterns" as Tab, label: "Patterns", icon: TrendingUp },
                { id: "proposals" as Tab, label: "Proposals", icon: Lightbulb },
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

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Records Tab */}
              {tab === "records" && (
                <div className="pt-4 space-y-3">
                  {records.length > 0 ? (
                    records.map((record) => (
                      <div
                        key={record.id}
                        className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {record.incident_type}
                          </span>
                          <div className="flex items-center gap-2">
                            {record.severity && (
                              <span className={`text-xs px-2 py-0.5 rounded ${severityColor(record.severity)}`}>
                                {record.severity}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {new Date(record.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {record.root_cause && (
                          <div className="text-xs text-slate-400">
                            <span className="text-slate-500">Root cause:</span> {record.root_cause}
                          </div>
                        )}
                        {record.resolution && (
                          <div className="text-xs text-slate-400">
                            <span className="text-slate-500">Resolution:</span> {record.resolution}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No learning records yet
                    </div>
                  )}
                </div>
              )}

              {/* Patterns Tab */}
              {tab === "patterns" && (
                <div className="pt-4 space-y-3">
                  {patterns.length > 0 ? (
                    patterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {pattern.pattern_type}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">
                            {pattern.occurrence_count} occurrences
                          </span>
                        </div>
                        {pattern.description && (
                          <p className="text-xs text-slate-400">{pattern.description}</p>
                        )}
                        <div className="flex gap-4 text-xs text-slate-500">
                          {pattern.first_seen && (
                            <span>First seen: {new Date(pattern.first_seen).toLocaleDateString()}</span>
                          )}
                          {pattern.last_seen && (
                            <span>Last seen: {new Date(pattern.last_seen).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No patterns detected yet. Click &quot;Detect Patterns&quot; to scan.
                    </div>
                  )}
                </div>
              )}

              {/* Proposals Tab */}
              {tab === "proposals" && (
                <div className="pt-4 space-y-3">
                  {proposals.length > 0 ? (
                    proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {proposal.title}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor(proposal.status)}`}>
                            {proposal.status}
                          </span>
                        </div>
                        {proposal.description && (
                          <p className="text-xs text-slate-400">{proposal.description}</p>
                        )}
                        {proposal.proposed_action && (
                          <div className="text-xs text-slate-400">
                            <span className="text-slate-500">Proposed action:</span> {proposal.proposed_action}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleVote(proposal.id, "up")}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-400 transition-colors"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {proposal.votes_up}
                            </button>
                            <button
                              onClick={() => handleVote(proposal.id, "down")}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                              {proposal.votes_down}
                            </button>
                          </div>
                          {proposal.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateStatus(proposal.id, "approved")}
                                className="px-3 py-1 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(proposal.id, "rejected")}
                                className="px-3 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      No proposals yet. Detect patterns to auto-generate proposals.
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
