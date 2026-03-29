"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Loader2, ChevronRight } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, JiraDashboardResponse } from "@/lib/api";

export default function JiraDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<JiraDashboardResponse | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchDashboard();
  }, [router]);

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await api.getJiraDashboard(100);
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  const stats = data?.stats;
  const completionLabel = useMemo(() => {
    if (!stats) return "LOW";
    if (stats.average_completion >= 80) return "HIGH";
    if (stats.average_completion >= 50) return "MEDIUM";
    return "LOW";
  }, [stats]);

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="jira" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Jira Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500">
            End-to-end Jira webhook visibility: intake, analysis, approvals, execution, completion, and error split.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : !data || !stats ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              No Jira data yet. Trigger webhook flow from Jira → n8n → MARS.
            </div>
          ) : (
            <div className="pt-6 space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Total Tickets" value={String(stats.total_tickets)} />
                <StatCard label="Avg Completion" value={`${stats.average_completion.toFixed(1)}%`} />
                <StatCard label="High Confidence" value={String(stats.high_confidence_tickets)} />
                <StatCard
                  label="Needs Rephase"
                  value={String(stats.tickets_needing_rephase)}
                  tone={stats.tickets_needing_rephase > 0 ? "warn" : "ok"}
                />
              </div>

              <div className="px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-slate-400">Pipeline Snapshot</h2>
                  <span className="text-xs text-slate-500">Fulfillment Level: {completionLabel}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <PhasePill label="Requirement" value={stats.active_requirements} />
                  <PhasePill label="Planning" value={stats.active_planning} />
                  <PhasePill label="Coding" value={stats.active_coding} />
                  <PhasePill label="Clarification" value={stats.active_clarification} />
                </div>
              </div>

              <div className="space-y-3">
                {data.tickets.map((row) => {
                  const ticket = row.ticket;
                  const metrics = row.metrics;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => router.push(`/chat/jira/${ticket.id}`)}
                      className="w-full text-left px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-cyan-400">{ticket.jira_key || "—"}</span>
                          <span className="text-sm font-medium text-white truncate max-w-[620px]">{ticket.summary}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>

                      <div className="w-full h-1.5 rounded bg-white/[0.05] overflow-hidden mb-3">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{ width: `${Math.min(100, Math.max(0, metrics.completion_percentage))}%` }}
                        />
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <Badge>{ticket.phase}</Badge>
                        <Badge>{ticket.status}</Badge>
                        <span className="text-slate-400">Completion {metrics.completion_percentage.toFixed(0)}%</span>
                        <span className="text-slate-400">AI {metrics.ai_help_level}</span>
                        <span className="text-slate-400">Confidence {metrics.confidence_bucket}</span>
                        {metrics.total_errors > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {metrics.total_errors} issue{metrics.total_errors > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
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

function PhasePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">{children}</span>;
}
