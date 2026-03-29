"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  GitBranch,
  Server,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Ticket, AnalysisResult, TicketQuestion, TechnicalPlan } from "@/lib/api";
import CrossPlatformReview from "@/components/plan/CrossPlatformReview";

interface DispatchGroupMember {
  id: string;
  repository_id: string;
  execution_id: string;
  status: string;
}

interface DispatchGroup {
  id: string;
  ticket_id: string;
  group_order: number;
  status: string;
  members: DispatchGroupMember[];
}

const PHASES = ["intake", "clarification", "requirement", "planning", "coding", "pr_creation", "done"];

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [questions, setQuestions] = useState<TicketQuestion[]>([]);
  const [dispatchGroups, setDispatchGroups] = useState<DispatchGroup[]>([]);
  const [plan, setPlan] = useState<TechnicalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchTicket();
  }, [id, router]);

  const fetchTicket = async () => {
    setLoading(true);
    const res = await api.getTicket(id);
    if (res.success && res.data) {
      setTicket(res.data);
    }
    const analysisRes = await api.getTicketAnalysis(id);
    if (analysisRes.success && analysisRes.data) {
      setAnalysis(analysisRes.data);
    }
    const questionsRes = await api.getTicketQuestions(id);
    if (questionsRes.success && questionsRes.data) {
      setQuestions(Array.isArray(questionsRes.data) ? questionsRes.data : []);
    }
    const groupsRes = await api.getDispatchGroups(id);
    if (groupsRes.success && groupsRes.data) {
      setDispatchGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
    }
    // Fetch plans for this ticket
    const plansRes = await api.listPlans();
    if (plansRes.success && plansRes.data) {
      const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
      const ticketPlan = plans.find((p) => p.ticket_id === id);
      if (ticketPlan) setPlan(ticketPlan);
    }
    setLoading(false);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const res = await api.analyzeTicket(id);
    if (res.success && res.data) {
      setAnalysis(res.data);
    }
    setAnalyzing(false);
  };

  const handleApprove = async () => {
    if (!ticket) return;
    setApproving(true);
    const res = await api.approveTicketPhase(id, ticket.phase, "approve");
    if (res.success && res.data) {
      setTicket((prev) =>
        prev ? { ...prev, phase: res.data!.next_phase } : prev
      );
    }
    setApproving(false);
  };

  const currentPhaseIndex = ticket
    ? PHASES.indexOf(ticket.phase)
    : 0;

  const riskColor = (risk: string) => {
    const colors: Record<string, string> = {
      high: "text-red-400 bg-red-500/10",
      medium: "text-yellow-400 bg-yellow-500/10",
      low: "text-green-400 bg-green-500/10",
    };
    return colors[risk?.toLowerCase()] || "text-slate-400 bg-white/[0.05]";
  };

  const confidenceText = (confidence: string | number) => {
    if (typeof confidence === "number") {
      return `${Math.round(confidence * 100)}%`;
    }
    const normalized = String(confidence || "").toUpperCase();
    if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
      return normalized;
    }
    return "MEDIUM";
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="tickets" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-white/[0.06]">
          <button
            onClick={() => router.push("/chat/tickets")}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </button>

          {ticket && (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-mono text-purple-400">
                    {ticket.jira_key || "—"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                    {ticket.issue_type}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-white">
                  {ticket.summary}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {!analysis && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    Analyze
                  </button>
                )}
                {ticket.phase !== "done" && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve Phase
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : ticket ? (
            <div className="pt-6 space-y-6">
              {/* Phase Progress */}
              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-medium text-slate-400 mb-3">
                  Phase Progress
                </h3>
                <div className="flex items-center gap-2">
                  {PHASES.map((phase, i) => {
                    const isComplete = i < currentPhaseIndex;
                    const isCurrent = i === currentPhaseIndex;
                    return (
                      <div key={phase} className="flex items-center gap-2 flex-1">
                        <div
                          className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                            isComplete
                              ? "bg-green-500/20 text-green-400"
                              : isCurrent
                              ? "bg-purple-500/20 text-purple-400 ring-2 ring-purple-500/30"
                              : "bg-white/[0.05] text-slate-500"
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : isCurrent ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            isComplete
                              ? "text-green-400"
                              : isCurrent
                              ? "text-purple-400"
                              : "text-slate-500"
                          }`}
                        >
                          {phase.replace("_", " ")}
                        </span>
                        {i < PHASES.length - 1 && (
                          <div
                            className={`flex-1 h-px ${
                              isComplete ? "bg-green-500/30" : "bg-white/[0.06]"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ticket Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <h3 className="text-sm font-medium text-slate-400">
                    Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="text-white">{ticket.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Priority</span>
                      <span className="text-white">{ticket.priority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reporter</span>
                      <span className="text-white">{ticket.reporter || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assignee</span>
                      <span className="text-white">{ticket.assignee || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Project</span>
                      <span className="text-white">{ticket.jira_project}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <h3 className="text-sm font-medium text-slate-400">
                    Description
                  </h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {ticket.description || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Analysis Results */}
              {analysis && (
                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-400">
                      Analysis Results
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${riskColor(analysis.risk_level)}`}>
                        Risk: {analysis.risk_level}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                        Confidence: {confidenceText(analysis.confidence)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500">Requirement Summary</span>
                      <p className="text-slate-300 mt-1">{analysis.requirement_summary}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Scope Assessment</span>
                      <p className="text-slate-300 mt-1">{analysis.scope_assessment}</p>
                    </div>
                    {analysis.affected_services && (
                      <div>
                        <span className="text-slate-500">Affected Services</span>
                        <p className="text-slate-300 mt-1">{analysis.affected_services}</p>
                      </div>
                    )}
                    {analysis.dependencies && (
                      <div>
                        <span className="text-slate-500">Dependencies</span>
                        <p className="text-slate-300 mt-1">{analysis.dependencies}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Clarification Q&A */}
              {questions.length > 0 && (
                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-medium text-slate-400">
                        Clarification Questions
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                        {questions.filter((q) => q.status === "answered").length} answered
                      </span>
                      {questions.some((q) => q.status === "pending") && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          {questions.filter((q) => q.status === "pending").length} pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        className="px-4 py-3 rounded-lg border border-white/[0.04] bg-white/[0.02]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono text-purple-400 mt-0.5">
                            Q{i + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm text-slate-300">{q.question}</p>
                            {q.status === "answered" && q.answer ? (
                              <div className="flex items-start gap-2 mt-2 pl-3 border-l-2 border-green-500/30">
                                <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm text-green-300">{q.answer}</p>
                                  {q.answered_by && (
                                    <span className="text-[10px] text-slate-500 mt-1 block">
                                      — {q.answered_by}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span className="text-xs text-amber-400">
                                  Awaiting answer on Jira
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {ticket?.phase === "clarification" && (
                    <p className="text-[11px] text-slate-500 text-center pt-1">
                      Pipeline paused — reply to the Jira comment with numbered answers to continue
                    </p>
                  )}
                </div>
              )}

              {/* Multi-Project Dispatch Groups */}
              {dispatchGroups.length > 0 && (
                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-medium text-slate-400">
                      Multi-Project Dispatch
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                      {dispatchGroups.length} batch{dispatchGroups.length > 1 ? "es" : ""}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {dispatchGroups
                      .sort((a, b) => a.group_order - b.group_order)
                      .map((group, gi) => (
                        <div key={group.id}>
                          {/* Batch header */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                              Batch {group.group_order + 1}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                group.status === "completed"
                                  ? "bg-green-500/10 text-green-400"
                                  : group.status === "running"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : group.status === "failed"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-white/[0.05] text-slate-500"
                              }`}
                            >
                              {group.status}
                            </span>
                            {group.members.length > 1 && (
                              <span className="text-[10px] text-slate-600">
                                (parallel)
                              </span>
                            )}
                          </div>

                          {/* Members (repos) */}
                          <div className="grid grid-cols-1 gap-2 pl-4">
                            {group.members.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                              >
                                <Server className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs text-slate-300 font-mono flex-1 truncate">
                                  {member.repository_id.substring(0, 8)}...
                                </span>
                                {member.status === "completed" && (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                )}
                                {member.status === "running" && (
                                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                )}
                                {member.status === "failed" && (
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                )}
                                {member.status === "pending" && (
                                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                <span
                                  className={`text-[10px] ${
                                    member.status === "completed"
                                      ? "text-green-400"
                                      : member.status === "running"
                                      ? "text-amber-400"
                                      : member.status === "failed"
                                      ? "text-red-400"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {member.status}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Arrow between batches */}
                          {gi < dispatchGroups.length - 1 && (
                            <div className="flex items-center justify-center py-2">
                              <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Cross-Platform Plan Review */}
              {plan && (
                <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <CrossPlatformReview planId={plan.id} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Ticket not found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
