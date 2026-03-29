"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket as TicketIcon, Loader2, ChevronRight } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Ticket } from "@/lib/api";

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchTickets();
  }, [router]);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await api.getTickets(100);
    if (res.success && res.data) {
      setTickets(res.data);
    }
    setLoading(false);
  };

  const phaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      intake: "text-slate-400 bg-white/[0.05]",
      requirement: "text-blue-400 bg-blue-500/10",
      planning: "text-purple-400 bg-purple-500/10",
      coding: "text-yellow-400 bg-yellow-500/10",
      pr_creation: "text-orange-400 bg-orange-500/10",
      done: "text-green-400 bg-green-500/10",
    };
    return colors[phase] || "text-slate-400 bg-white/[0.05]";
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      received: "text-slate-400 bg-white/[0.05]",
      analyzing: "text-blue-400 bg-blue-500/10",
      analyzed: "text-cyan-400 bg-cyan-500/10",
      planning: "text-purple-400 bg-purple-500/10",
      plan_approved: "text-indigo-400 bg-indigo-500/10",
      coding: "text-yellow-400 bg-yellow-500/10",
      pr_created: "text-orange-400 bg-orange-500/10",
      completed: "text-green-400 bg-green-500/10",
      failed: "text-red-400 bg-red-500/10",
    };
    return colors[status] || "text-slate-400 bg-white/[0.05]";
  };

  const priorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "text-red-400",
      high: "text-orange-400",
      medium: "text-yellow-400",
      low: "text-green-400",
    };
    return colors[priority?.toLowerCase()] || "text-slate-400";
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="tickets" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <TicketIcon className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
          </div>
          <p className="text-sm text-slate-500">
            Jira tickets ingested via webhooks and their analysis pipeline status
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3 pt-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => router.push(`/chat/tickets/${ticket.id}`)}
                  className="w-full text-left px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-purple-400">
                        {ticket.jira_key || "—"}
                      </span>
                      <span className="text-sm font-medium text-white truncate max-w-md">
                        {ticket.summary}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded ${statusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${phaseColor(ticket.phase)}`}>
                      {ticket.phase}
                    </span>
                    {ticket.priority && (
                      <span className={priorityColor(ticket.priority)}>
                        {ticket.priority}
                      </span>
                    )}
                    {ticket.assignee && (
                      <span className="text-slate-500">
                        {ticket.assignee}
                      </span>
                    )}
                    <span className="text-slate-600 ml-auto">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 text-sm">
              No tickets yet. Configure the Jira webhook via n8n to start ingesting tickets.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
