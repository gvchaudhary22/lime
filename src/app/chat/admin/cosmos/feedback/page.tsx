"use client";

import { Star, Check, X, SkipForward } from "lucide-react";

const stats = [
  { label: "Total Traces", value: 47, color: "text-blue-400" },
  { label: "Low Confidence", value: 23, color: "text-yellow-400" },
  { label: "Ambiguous", value: 24, color: "text-orange-400" },
  { label: "Action Candidates", value: 8, color: "text-purple-400" },
  { label: "Negative Examples", value: 12, color: "text-red-400" },
];

const feedbackRows = [
  {
    query: "What is the order lifecycle?",
    confidence: 0.28,
    type: "low_confidence",
    autoAction: "missing_kb_coverage",
    created: "2h ago",
  },
  {
    query: "Cancel karo shipment ya order?",
    confidence: 0.45,
    type: "ambiguous",
    autoAction: "add_clarification_rule",
    created: "5h ago",
  },
  {
    query: "Courier wala nahi aaya",
    confidence: 0.35,
    type: "low_confidence",
    autoAction: "missing_action_candidate",
    created: "1d ago",
  },
  {
    query: "COD paisa kab milega?",
    confidence: 0.52,
    type: "ambiguous",
    autoAction: "add_negative_example",
    created: "1d ago",
  },
  {
    query: "Weight dispute raise",
    confidence: 0.41,
    type: "low_confidence",
    autoAction: "missing_kb_coverage",
    created: "2d ago",
  },
];

const typeBadge = (t: string) =>
  t === "low_confidence"
    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    : "bg-orange-500/20 text-orange-400 border-orange-500/30";

const confidenceColor = (c: number) =>
  c < 0.35 ? "text-red-400" : c < 0.5 ? "text-yellow-400" : "text-orange-400";

export default function FeedbackReviewPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Feedback Review</h1>
          <p className="text-xs text-slate-500">Approve or reject KB improvements from low-confidence traces</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#111830] border border-white/[0.06] rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Query</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Confidence</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Type</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Auto Actions</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Created</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedbackRows.map((row) => (
              <tr key={row.query} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm text-white">{row.query}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-mono font-medium ${confidenceColor(row.confidence)}`}>
                    {row.confidence.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge(row.type)}`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-400 font-mono">{row.autoAction}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500">{row.created}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors" title="Approve">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="Reject">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors" title="Skip">
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
