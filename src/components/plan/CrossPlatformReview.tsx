"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  Shield,
  Zap,
  Eye,
} from "lucide-react";
import {
  api,
  PlatformReview,
  ConsensusResult,
  PlanRecommendation,
  PlanRisk,
  ConflictItem,
  PlatformOutput,
} from "@/lib/api";

interface CrossPlatformReviewProps {
  planId: string;
}

export default function CrossPlatformReview({ planId }: CrossPlatformReviewProps) {
  const [reviews, setReviews] = useState<PlatformReview[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [reviewsRes, consensusRes] = await Promise.all([
      api.getCrossReview(planId),
      api.getConsensus(planId),
    ]);
    if (reviewsRes.success && reviewsRes.data) {
      setReviews(Array.isArray(reviewsRes.data) ? reviewsRes.data : []);
    }
    if (consensusRes.success && consensusRes.data) {
      setConsensus(consensusRes.data);
    }
    setLoaded(true);
    setLoading(false);
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setError(null);
    const res = await api.triggerCrossReview(planId);
    if (res.success && res.data) {
      setReviews(res.data.reviews || []);
      setConsensus(res.data.consensus || null);
      setLoaded(true);
    } else {
      setError(res.error || "Failed to trigger cross-review");
    }
    setTriggering(false);
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) return;
    setOverriding(true);
    const res = await api.overrideConsensus(planId, overrideReason.trim());
    if (res.success && res.data) {
      setConsensus(res.data);
      setShowOverride(false);
      setOverrideReason("");
    }
    setOverriding(false);
  };

  const parsePlatformOutput = (review: PlatformReview): PlatformOutput | null => {
    if (!review.parsed_output || review.parsed_output === "null") return null;
    try {
      return JSON.parse(review.parsed_output);
    } catch {
      return null;
    }
  };

  const parseJSON = <T,>(jsonStr: string): T | null => {
    if (!jsonStr || jsonStr === "null") return null;
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  };

  const decisionColor = (decision: string) => {
    const colors: Record<string, string> = {
      consensus: "text-green-400 bg-green-500/10",
      partial: "text-yellow-400 bg-yellow-500/10",
      conflict: "text-red-400 bg-red-500/10",
      override: "text-blue-400 bg-blue-500/10",
      pending: "text-slate-400 bg-white/[0.05]",
    };
    return colors[decision] || "text-slate-400 bg-white/[0.05]";
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
      case "timeout":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const priorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "text-red-400 bg-red-500/10",
      high: "text-orange-400 bg-orange-500/10",
      medium: "text-yellow-400 bg-yellow-500/10",
      low: "text-green-400 bg-green-500/10",
    };
    return colors[priority?.toLowerCase()] || "text-slate-400 bg-white/[0.05]";
  };

  const severityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "text-red-400",
      high: "text-orange-400",
      medium: "text-yellow-400",
      low: "text-green-400",
    };
    return colors[severity?.toLowerCase()] || "text-slate-400";
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-slate-400">
            Cross-Platform Review
          </h3>
          {consensus && (
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-medium ${decisionColor(consensus.decision)}`}>
              {consensus.decision}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loaded && !loading && (
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Load Reviews
            </button>
          )}
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {triggering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {triggering ? "Running..." : "Run Cross-Review"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Consensus Summary */}
      {consensus && (
        <div className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Consensus</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {consensus.platforms_responded}/{consensus.platforms_queried} platforms
              </span>
              {(consensus.decision === "conflict" || consensus.decision === "partial") && (
                <button
                  onClick={() => setShowOverride(true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  Override
                </button>
              )}
            </div>
          </div>

          {/* Score bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Agreement Score</span>
              <span className="text-xs font-mono text-white">
                {Math.round(consensus.consensus_score * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  consensus.consensus_score >= 0.8
                    ? "bg-green-500"
                    : consensus.consensus_score >= 0.5
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.round(consensus.consensus_score * 100)}%` }}
              />
            </div>
          </div>

          {/* Common recommendations */}
          {(() => {
            const common = parseJSON<PlanRecommendation[]>(consensus.common_items);
            if (!common || common.length === 0) return null;
            return (
              <div className="mb-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Recommendations ({common.length})
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {common.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white font-medium">{rec.area}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColor(rec.priority)}`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{rec.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Conflicts */}
          {(() => {
            const conflicts = parseJSON<ConflictItem[]>(consensus.conflicts);
            if (!conflicts || conflicts.length === 0) return null;
            return (
              <div className="mb-3">
                <span className="text-[10px] text-red-400 uppercase tracking-wider">
                  Conflicts ({conflicts.length})
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {conflicts.map((conflict, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="text-xs text-white font-medium">{conflict.area}</span>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(conflict.positions).map(([platform, action]) => (
                          <div key={platform} className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-500 font-mono">{platform}:</span>
                            <span className="text-red-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Risks */}
          {(() => {
            const risks = parseJSON<PlanRisk[]>(consensus.risk_union);
            if (!risks || risks.length === 0) return null;
            return (
              <div>
                <span className="text-[10px] text-amber-400 uppercase tracking-wider">
                  Risks ({risks.length})
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {risks.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${severityColor(risk.severity)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300">{risk.description}</p>
                        {risk.mitigation && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Mitigation: {risk.mitigation}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] shrink-0 ${severityColor(risk.severity)}`}>
                        {risk.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Override info */}
          {consensus.override_by && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-400">
                  Overridden by {consensus.override_by}
                </span>
              </div>
              {consensus.override_reason && (
                <p className="text-[11px] text-slate-400 mt-1 pl-5">
                  {consensus.override_reason}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Platform Reviews */}
      {reviews.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            Platform Reviews ({reviews.length})
          </span>
          {reviews.map((review) => {
            const output = parsePlatformOutput(review);
            return (
              <div
                key={review.id}
                className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(review.status)}
                    <span className="text-sm text-white font-medium">
                      {review.platform_key}
                    </span>
                    {review.model && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {review.model}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {review.latency_ms > 0 && (
                      <span className="text-[10px] text-slate-500">
                        {review.latency_ms}ms
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      review.status === "completed"
                        ? "bg-green-500/10 text-green-400"
                        : review.status === "failed" || review.status === "timeout"
                        ? "bg-red-500/10 text-red-400"
                        : review.status === "running"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-white/[0.05] text-slate-500"
                    }`}>
                      {review.status}
                    </span>
                  </div>
                </div>

                {review.error && (
                  <p className="text-xs text-red-400 mt-2">{review.error}</p>
                )}

                {output && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        output.verdict === "approved" || output.verdict === "approve"
                          ? "bg-green-500/10 text-green-400"
                          : output.verdict === "rejected" || output.verdict === "reject"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {output.verdict}
                      </span>
                      {output.confidence && (
                        <span className="text-[10px] text-slate-500">
                          Confidence: {output.confidence}
                        </span>
                      )}
                      {output.blast_radius && (
                        <span className="text-[10px] text-slate-500">
                          Blast radius: {output.blast_radius}
                        </span>
                      )}
                    </div>

                    {output.recommendations && output.recommendations.length > 0 && (
                      <div className="space-y-1">
                        {output.recommendations.slice(0, 3).map((rec, i) => (
                          <div key={i} className="text-[11px] text-slate-400">
                            <span className="text-slate-500">{rec.area}:</span> {rec.action}
                          </div>
                        ))}
                        {output.recommendations.length > 3 && (
                          <span className="text-[10px] text-slate-600">
                            +{output.recommendations.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {loaded && reviews.length === 0 && !consensus && !error && (
        <div className="text-center py-6 text-sm text-slate-500">
          No cross-platform reviews yet. Click &quot;Run Cross-Review&quot; to start.
        </div>
      )}

      {/* Override Modal */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] rounded-xl border border-[#222] w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Override Consensus
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Provide a reason for overriding the consensus decision. This will be recorded in the audit trail.
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for override..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-slate-600 resize-none h-24 focus:outline-none focus:border-purple-500/50"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowOverride(false); setOverrideReason(""); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOverride}
                disabled={overriding || !overrideReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {overriding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
