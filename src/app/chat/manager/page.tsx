"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  MessageSquare,
  Layers,
  Bug,
  ExternalLink,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import {
  api,
  PRLearningReview,
  PRLearningBundle,
  KnowledgeContribution,
  ELKBug,
} from "@/lib/api";

type View = "reviews" | "bundle" | "elk-reviews";
type ManagerTab = "pr-learning" | "elk-bugs";

interface RepoOption {
  id: string;
  name: string;
}

export default function ManagerPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("reviews");
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState(false);

  // Reviews
  const [pendingReviews, setPendingReviews] = useState<PRLearningReview[]>([]);
  const [myReviews, setMyReviews] = useState<PRLearningReview[]>([]);
  const [showMine, setShowMine] = useState(false);

  // Manager tab
  const [activeTab, setActiveTab] = useState<ManagerTab>("elk-bugs");

  // ELK Bug Reviews
  const [elkPendingReviews, setElkPendingReviews] = useState<ELKBug[]>([]);
  const [elkReviewingId, setElkReviewingId] = useState<string | null>(null);
  const [elkReviewComment, setElkReviewComment] = useState("");

  // Bundle review
  const [bundle, setBundle] = useState<PRLearningBundle | null>(null);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [decisions, setDecisions] = useState<Record<string, { action: string; feedback: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchRepos();
    fetchMyReviews();
    fetchElkPendingReviews();
  }, [router]);

  useEffect(() => {
    if (selectedRepo) fetchPendingReviews();
  }, [selectedRepo]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRepos = async () => {
    const res = await api.getProjects();
    if (res.success && res.data) {
      setRepos(res.data.map((p) => ({ id: p.repository_id || p.id, name: p.name })));
      if (res.data.length > 0) setSelectedRepo(res.data[0].repository_id || res.data[0].id);
    }
  };

  const fetchPendingReviews = async () => {
    setLoading(true);
    const res = await api.getPendingReviews(selectedRepo);
    if (res.success && res.data) setPendingReviews(res.data);
    else setPendingReviews([]);
    setLoading(false);
  };

  const fetchMyReviews = async () => {
    const res = await api.getMyReviews();
    if (res.success && res.data) setMyReviews(res.data);
  };

  const fetchElkPendingReviews = async () => {
    const res = await api.listELKBugPendingReviews();
    if (res.success && res.data) setElkPendingReviews(res.data);
    else setElkPendingReviews([]);
  };

  const submitElkReview = async (bugId: string, action: "approve" | "reject") => {
    await api.submitELKBugReview(bugId, action, elkReviewComment);
    setElkReviewingId(null);
    setElkReviewComment("");
    fetchElkPendingReviews();
  };

  const openBundle = async (prId: string) => {
    setLoading(true);
    const res = await api.getPRLearningBundle(prId);
    if (res.success && res.data) {
      setBundle(res.data);
      // Initialize decisions
      const decs: Record<string, { action: string; feedback: string }> = {};
      for (const c of res.data.contributions) {
        decs[c.id] = { action: "approve", feedback: "" };
      }
      setDecisions(decs);
      setOverallFeedback("");
      setView("bundle");
    }
    setLoading(false);
  };

  const setDecisionAction = (id: string, action: string) => {
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], action } }));
  };

  const handleSubmitReview = async () => {
    if (!bundle) return;
    setSubmitting(true);
    const decisionList = Object.entries(decisions).map(([id, d]) => ({
      contribution_id: id,
      action: d.action,
      feedback: d.feedback,
    }));
    await api.submitPRReview(bundle.pr_id, {
      overall_feedback: overallFeedback,
      decisions: decisionList,
    });
    setSubmitting(false);
    setView("reviews");
    setBundle(null);
    fetchPendingReviews();
    fetchMyReviews();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10",
      completed: "text-green-400 bg-green-500/10",
    };
    return colors[status] || "text-slate-400 bg-white/[0.05]";
  };

  const reviewsList = showMine ? myReviews : pendingReviews;

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="manager" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardCheck className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">
              {view === "bundle" ? "Review PR Learning" : "Manager Panel"}
            </h1>
          </div>

          {/* Tab Switcher */}
          {view !== "bundle" && (
            <div className="flex gap-1 mb-4">
              <button onClick={() => { setActiveTab("elk-bugs"); setView("elk-reviews"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "elk-bugs" ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300"}`}>
                <Bug className="w-4 h-4" />
                ELK Bug PRs
                {elkPendingReviews.length > 0 && <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-300 text-[10px] rounded-full">{elkPendingReviews.length}</span>}
              </button>
              <button onClick={() => { setActiveTab("pr-learning"); setView("reviews"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "pr-learning" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300"}`}>
                <Layers className="w-4 h-4" />
                PR Learnings
                {pendingReviews.length > 0 && <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] rounded-full">{pendingReviews.length}</span>}
              </button>
            </div>
          )}

          {view === "reviews" && (
            <>
              {/* Repo selector + toggle */}
              <div className="flex items-center gap-4 mb-4">
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#0c0515] border border-white/[0.08] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                  <option value="">Select a repository</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>

                <div className="flex gap-1">
                  <button
                    onClick={() => setShowMine(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !showMine
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-white/[0.03] text-slate-500 border border-white/[0.06]"
                    }`}
                  >
                    Pending ({pendingReviews.length})
                  </button>
                  <button
                    onClick={() => setShowMine(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showMine
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-white/[0.03] text-slate-500 border border-white/[0.06]"
                    }`}
                  >
                    My Reviews ({myReviews.length})
                  </button>
                </div>
              </div>
            </>
          )}

          {view === "bundle" && (
            <button
              onClick={() => { setView("reviews"); setBundle(null); }}
              className="text-xs text-purple-400 hover:text-purple-300 mb-2"
            >
              Back to reviews
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : view === "reviews" ? (
            /* Reviews List */
            <div className="space-y-3 pt-2">
              {reviewsList.length > 0 ? (
                reviewsList.map((review) => (
                  <button
                    key={review.id}
                    onClick={() => review.status === "pending" && openBundle(review.pr_id)}
                    disabled={review.status !== "pending"}
                    className="w-full text-left px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcon(review.status)}
                        <div>
                          <span className="text-sm font-medium text-white">PR: {review.pr_id}</span>
                          <span className="text-xs text-slate-500 ml-2">{review.module_path}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{review.contribution_count} contributions</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusColor(review.status)}`}>
                          {review.status}
                        </span>
                        {review.status === "pending" && (
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    </div>
                    {review.status === "completed" && (
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span className="text-green-400">{review.approved_count} approved</span>
                        <span className="text-red-400">{review.rejected_count} rejected</span>
                        {review.overall_feedback && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {review.overall_feedback}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-16 text-slate-500 text-sm">
                  {showMine ? "No reviews assigned to you" : "No pending reviews for this repository"}
                </div>
              )}
            </div>
          ) : bundle ? (
            /* Bundle Review */
            <div className="space-y-6 pt-2">
              {/* By module groups */}
              {Object.entries(bundle.by_module).map(([modulePath, contribs]) => (
                <div key={modulePath} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-medium text-white">{modulePath}</h3>
                    <span className="text-xs text-slate-500">{contribs.length} contributions</span>
                  </div>

                  <div className="space-y-3">
                    {contribs.map((c: KnowledgeContribution) => (
                      <div key={c.id} className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm text-white">{c.title}</span>
                            <span className="text-xs text-slate-500 ml-2">{c.target_section}</span>
                          </div>
                          <span className="text-xs text-slate-500">{c.source_type}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{c.content}</p>

                        {/* Decision buttons */}
                        <div className="flex items-center gap-2">
                          {["approve", "reject", "edit"].map((action) => (
                            <button
                              key={action}
                              onClick={() => setDecisionAction(c.id, action)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                decisions[c.id]?.action === action
                                  ? action === "approve"
                                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                    : action === "reject"
                                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-white/[0.03] text-slate-500 border border-white/[0.06]"
                              }`}
                            >
                              {action.charAt(0).toUpperCase() + action.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Overall feedback */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-medium text-white mb-3">Overall Feedback</h3>
                <textarea
                  value={overallFeedback}
                  onChange={(e) => setOverallFeedback(e.target.value)}
                  rows={3}
                  placeholder="Optional feedback for the entire PR learning bundle..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Review
              </button>
            </div>
          ) : view === "elk-reviews" ? (
            /* ═══ ELK BUG REVIEWS TAB ═══ */
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {elkPendingReviews.length === 0 ? (
                <div className="text-center py-20">
                  <Bug className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-500">No ELK bug PRs pending review</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400 mb-2">{elkPendingReviews.length} bug fix PR{elkPendingReviews.length > 1 ? "s" : ""} awaiting your review</p>
                  {elkPendingReviews.map((bug) => (
                    <div key={bug.id} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
                      {/* Bug Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                              bug.severity === "critical" ? "bg-red-600/30 text-red-300 border border-red-500/30" :
                              bug.severity === "high" ? "bg-orange-600/30 text-orange-300 border border-orange-500/30" :
                              bug.severity === "medium" ? "bg-yellow-600/30 text-yellow-300 border border-yellow-500/30" :
                              "bg-zinc-600/30 text-zinc-300 border border-zinc-500/30"
                            }`}>{bug.severity}</span>
                            <span className="text-[10px] text-zinc-500">{bug.occurrence_count}x in 24h</span>
                            <span className="text-[10px] text-zinc-600">•</span>
                            <span className="text-[10px] text-zinc-500">{bug.index_pattern}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-white">{bug.error_message}</h3>
                          {bug.source_file && (
                            <p className="text-[11px] text-zinc-500 mt-1 font-mono">{bug.source_file}{bug.source_line ? `:${bug.source_line}` : ""}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {bug.pr_url && (
                            <a href={bug.pr_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-600/20 text-blue-300 text-xs rounded-lg border border-blue-500/30 hover:bg-blue-600/30 flex items-center gap-1.5">
                              <ExternalLink className="w-3 h-3" /> View PR
                            </a>
                          )}
                          <button onClick={() => router.push(`/chat/admin/elk-bugs/${bug.id}/analysis`)} className="px-3 py-1.5 bg-purple-600/20 text-purple-300 text-xs rounded-lg border border-purple-500/30 hover:bg-purple-600/30 flex items-center gap-1.5">
                            <Eye className="w-3 h-3" /> Analysis
                          </button>
                        </div>
                      </div>

                      {/* AI Analysis Summary */}
                      {bug.ai_rca && (
                        <div className="bg-zinc-800/50 rounded-lg p-3 mb-3 text-xs text-zinc-400">
                          <span className="text-zinc-500 font-medium">RCA: </span>{bug.ai_rca.slice(0, 200)}{bug.ai_rca.length > 200 ? "..." : ""}
                        </div>
                      )}

                      {/* Learning from this fix */}
                      {bug.ai_fix_detail && (
                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3 mb-3">
                          <p className="text-[10px] text-purple-400 font-medium mb-1">Learning from this fix:</p>
                          <p className="text-xs text-zinc-400">{bug.ai_fix_detail.slice(0, 200)}{bug.ai_fix_detail.length > 200 ? "..." : ""}</p>
                        </div>
                      )}

                      {/* Review Actions */}
                      <div className="border-t border-zinc-800 pt-3 mt-3">
                        {elkReviewingId === bug.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={elkReviewComment}
                              onChange={(e) => setElkReviewComment(e.target.value)}
                              placeholder="Review comment / learning notes (optional)..."
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={() => submitElkReview(bug.id, "approve")} className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-medium rounded-lg border border-green-500/30 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Approve PR
                              </button>
                              <button onClick={() => submitElkReview(bug.id, "reject")} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-medium rounded-lg border border-red-500/30 flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                              <button onClick={() => setElkReviewingId(null)} className="text-xs text-zinc-500 hover:text-zinc-300 ml-2">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setElkReviewingId(bug.id)} className="px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-xs font-medium rounded-lg border border-orange-500/30 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Review This PR
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
