"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, RefreshCcw, CheckCircle2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, TicketJourneyResponse } from "@/lib/api";

const PHASES = ["intake", "clarification", "requirement", "planning", "coding", "pr_creation", "done"];

export default function JiraTicketJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<TicketJourneyResponse | null>(null);
  const [phase, setPhase] = useState("clarification");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchJourney();
  }, [router, ticketId]);

  const fetchJourney = async () => {
    setLoading(true);
    const res = await api.getTicketJourney(ticketId);
    if (res.success && res.data) {
      setData(res.data);
      setPhase(res.data.ticket.phase === "done" ? "planning" : res.data.ticket.phase);
    }
    setLoading(false);
  };

  const handleRephase = async () => {
    if (!data) return;
    setSubmitting(true);
    await api.rephaseTicket(data.ticket.id, phase, reason);
    setSubmitting(false);
    setReason("");
    await fetchJourney();
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="jira" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-6 pb-4 border-b border-white/[0.06]">
          <button
            onClick={() => router.push("/chat/jira")}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Jira Dashboard
          </button>

          {data && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-mono text-cyan-400">{data.ticket.jira_key}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                  {data.ticket.phase}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                  {data.ticket.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white">{data.ticket.summary}</h1>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-slate-500 text-sm">Ticket journey not found.</div>
          ) : (
            <div className="pt-6 space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Completion" value={`${data.metrics.completion_percentage.toFixed(0)}%`} />
                <MetricCard label="Confidence" value={data.metrics.confidence_bucket} />
                <MetricCard label="AI Help" value={`${data.metrics.ai_help_level} (${data.metrics.ai_help_score})`} />
                <MetricCard
                  label="Errors"
                  value={String(data.metrics.total_errors)}
                  tone={data.metrics.total_errors > 0 ? "warn" : "ok"}
                />
              </div>

              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h2 className="text-sm font-medium text-slate-400 mb-3">Error Bifurcation</h2>
                <div className="grid grid-cols-5 gap-3 text-xs">
                  {Object.entries(data.metrics.error_bifurcation).map(([bucket, count]) => (
                    <div key={bucket} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-slate-500 capitalize">{bucket}</p>
                      <p className={`font-medium ${count > 0 ? "text-amber-300" : "text-slate-300"}`}>{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-slate-400">Recommended Next Action</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                    {data.recommended_action}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  {data.rephase_suggestions.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCcw className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-medium text-slate-400">Rephase Ticket</h2>
                </div>
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded bg-[#140b22] border border-white/[0.1] text-sm text-white"
                  >
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rephase"
                    className="col-span-3 px-3 py-2 rounded bg-[#140b22] border border-white/[0.1] text-sm text-white placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={handleRephase}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-sm text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Rephase
                </button>
              </div>

              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h2 className="text-sm font-medium text-slate-400 mb-4">Timeline</h2>
                <div className="space-y-3">
                  {data.timeline.map((item, idx) => (
                    <div
                      key={`${item.timestamp}-${idx}`}
                      className="px-4 py-3 rounded-lg border border-white/[0.05] bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">{item.title}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{item.detail}</p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                        <span>{item.type}</span>
                        {item.phase && <span>• {item.phase}</span>}
                        {item.source && <span>• {item.source}</span>}
                        {item.status && <span>• {item.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "ok";
}) {
  const toneClass =
    tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-white";
  return (
    <div className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
