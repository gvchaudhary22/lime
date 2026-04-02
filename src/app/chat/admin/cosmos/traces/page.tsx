"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface TraceRow {
  id: number;
  time: string;
  query: string;
  agent: string;
  confidence: number;
  latency: string;
  tools: string[];
  mode: string;
  waveTrace: {
    wave: string;
    status: string;
    latency: string;
    detail: string;
  }[];
}

const mockTraces: TraceRow[] = [
  {
    id: 1, time: "14:32:05", query: "What is order status for 12345?", agent: "order_ops",
    confidence: 0.92, latency: "180ms", tools: ["order_lookup"], mode: "lookup",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "35ms", detail: "Matched 8 order docs, top similarity 0.94" },
      { wave: "Wave 2: GraphRAG", status: "done", latency: "65ms", detail: "Expanded via Order->Shipment hub" },
      { wave: "Wave 5: ReAct", status: "done", latency: "80ms", detail: "order_lookup(12345) returned status=shipped" },
    ],
  },
  {
    id: 2, time: "14:31:42", query: "Cancel this shipment", agent: "shipment_ops",
    confidence: 0.85, latency: "250ms", tools: ["cancel_shipment"], mode: "act",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "40ms", detail: "Identified cancel intent with 0.91 score" },
      { wave: "Wave 3: LangGraph", status: "done", latency: "110ms", detail: "Resolved shipment context from session" },
      { wave: "Wave 5: ReAct", status: "done", latency: "100ms", detail: "cancel_shipment(SH-9876) executed" },
    ],
  },
  {
    id: 3, time: "14:30:18", query: "Why was my weight disputed?", agent: "weight_dispute",
    confidence: 0.78, latency: "320ms", tools: ["dispute_lookup", "weight_proof"], mode: "lookup",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "50ms", detail: "Found 5 weight dispute docs" },
      { wave: "Wave 2: GraphRAG", status: "done", latency: "120ms", detail: "Traversed weight->dispute->resolution path" },
      { wave: "Wave 5: ReAct", status: "done", latency: "150ms", detail: "Retrieved dispute details and proof images" },
    ],
  },
  {
    id: 4, time: "14:29:55", query: "Update my bank account details", agent: "settings_admin",
    confidence: 0.95, latency: "140ms", tools: ["update_bank"], mode: "act",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "30ms", detail: "Direct match to bank settings action" },
      { wave: "Wave 5: ReAct", status: "done", latency: "110ms", detail: "Prompted user for IFSC verification" },
    ],
  },
  {
    id: 5, time: "14:28:30", query: "Show my wallet balance", agent: "billing_wallet",
    confidence: 0.97, latency: "95ms", tools: ["wallet_balance"], mode: "lookup",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "25ms", detail: "Exact match to wallet FAQ" },
      { wave: "Wave 5: ReAct", status: "done", latency: "70ms", detail: "wallet_balance() returned INR 12,450" },
    ],
  },
  {
    id: 6, time: "14:27:10", query: "How to integrate Shopify channel?", agent: "channel_sync",
    confidence: 0.88, latency: "210ms", tools: ["channel_guide"], mode: "lookup",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "45ms", detail: "Retrieved Shopify integration docs" },
      { wave: "Wave 2: GraphRAG", status: "done", latency: "85ms", detail: "Linked channel->API->webhook nodes" },
      { wave: "Wave 5: ReAct", status: "done", latency: "80ms", detail: "Formatted step-by-step guide" },
    ],
  },
  {
    id: 7, time: "14:26:00", query: "Escalate NDR for AWB 998877", agent: "ndr_resolver",
    confidence: 0.83, latency: "290ms", tools: ["ndr_escalate", "awb_lookup"], mode: "act",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "40ms", detail: "Identified NDR escalation intent" },
      { wave: "Wave 3: LangGraph", status: "done", latency: "100ms", detail: "Multi-hop: AWB->NDR->escalation workflow" },
      { wave: "Wave 5: ReAct", status: "done", latency: "150ms", detail: "ndr_escalate(AWB-998877) queued for re-attempt" },
    ],
  },
  {
    id: 8, time: "14:24:45", query: "What courier is cheapest for 500g Delhi to Mumbai?", agent: "courier_ops",
    confidence: 0.91, latency: "175ms", tools: ["rate_calculator"], mode: "lookup",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "35ms", detail: "Matched courier rate comparison docs" },
      { wave: "Wave 5: ReAct", status: "done", latency: "140ms", detail: "rate_calculator(500g, DEL, BOM) returned Delhivery at INR 45" },
    ],
  },
  {
    id: 9, time: "14:23:12", query: "Create return for order 67890", agent: "return_exchange",
    confidence: 0.44, latency: "380ms", tools: ["create_return", "order_lookup"], mode: "act",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "50ms", detail: "Found return policy docs but low relevance" },
      { wave: "Wave 2: GraphRAG", status: "done", latency: "130ms", detail: "Weak entity links, missing return reason" },
      { wave: "Wave 4: Neo4j", status: "done", latency: "100ms", detail: "Neo4j fallback found return workflow node" },
      { wave: "Wave 5: ReAct", status: "done", latency: "100ms", detail: "Prompted for return reason — confidence low" },
    ],
  },
  {
    id: 10, time: "14:22:00", query: "Generate last month sales report", agent: "report_analytics",
    confidence: 0.89, latency: "200ms", tools: ["report_generate"], mode: "act",
    waveTrace: [
      { wave: "Wave 1: Probe", status: "done", latency: "30ms", detail: "Matched report generation action" },
      { wave: "Wave 3: LangGraph", status: "done", latency: "70ms", detail: "Resolved date range: March 2026" },
      { wave: "Wave 5: ReAct", status: "done", latency: "100ms", detail: "report_generate(type=sales, range=2026-03) queued" },
    ],
  },
];

const confidenceColor = (c: number) => {
  if (c >= 0.8) return "text-green-400";
  if (c >= 0.5) return "text-yellow-400";
  return "text-red-400";
};

const confidenceBg = (c: number) => {
  if (c >= 0.8) return "bg-green-500/10";
  if (c >= 0.5) return "bg-yellow-500/10";
  return "bg-red-500/10";
};

export default function TracesPage() {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockTraces.filter(
    (t) =>
      t.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.agent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search queries or agents..."
          className="w-full bg-[#111830] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/40 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-8" />
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Time</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Query</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Agent</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Confidence</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Latency</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Tools</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((trace) => (
              <>
                <tr
                  key={trace.id}
                  onClick={() => setExpandedRow(expandedRow === trace.id ? null : trace.id)}
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    {expandedRow === trace.id ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{trace.time}</td>
                  <td className="px-4 py-3 text-sm text-white max-w-xs truncate">{trace.query}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {trace.agent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${confidenceColor(trace.confidence)}`}>
                      {trace.confidence.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{trace.latency}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {trace.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-[10px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      trace.mode === "act"
                        ? "text-orange-400 bg-orange-500/10"
                        : "text-cyan-400 bg-cyan-500/10"
                    }`}>
                      {trace.mode}
                    </span>
                  </td>
                </tr>
                {expandedRow === trace.id && (
                  <tr key={`${trace.id}-expanded`}>
                    <td colSpan={8} className="px-4 py-0">
                      <div className="bg-[#0a0e1a] border border-white/[0.04] rounded-lg p-4 my-2 space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wave Trace</h4>
                        {trace.waveTrace.map((w, i) => (
                          <div key={i} className="flex items-start gap-3 text-xs">
                            <span className={`font-medium w-32 shrink-0 ${
                              w.status === "done" ? "text-green-400" : "text-slate-500"
                            }`}>
                              {w.wave}
                            </span>
                            <span className="text-slate-500 font-mono w-12 shrink-0">{w.latency}</span>
                            <span className="text-slate-400">{w.detail}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
