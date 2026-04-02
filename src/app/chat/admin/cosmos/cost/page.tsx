"use client";

import { Gauge, DollarSign, Info } from "lucide-react";

const statCards = [
  { label: "Today", value: "$0.00", color: "text-green-400" },
  { label: "This Week", value: "$0.00", color: "text-blue-400" },
  { label: "This Month", value: "$0.00", color: "text-purple-400" },
];

const modelBreakdown = [
  { model: "Claude Haiku", purpose: "Query Intel", costPerQuery: "$0.001" },
  { model: "Claude Sonnet", purpose: "Reranking", costPerQuery: "$0.003" },
  { model: "Claude Sonnet", purpose: "Response Generation", costPerQuery: "$0.01" },
];

const agentCosts = [
  { agent: "order_ops", queries: 0, cost: "$0.00" },
  { agent: "shipment_ops", queries: 0, cost: "$0.00" },
  { agent: "ndr_ops", queries: 0, cost: "$0.00" },
  { agent: "billing_ops", queries: 0, cost: "$0.00" },
  { agent: "courier_ops", queries: 0, cost: "$0.00" },
  { agent: "returns_ops", queries: 0, cost: "$0.00" },
  { agent: "support_ops", queries: 0, cost: "$0.00" },
  { agent: "onboarding_ops", queries: 0, cost: "$0.00" },
];

export default function CostAnalyticsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Cost Analytics</h1>
          <p className="text-xs text-slate-500">Token usage and model cost breakdown</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Model Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Model Breakdown</h3>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Model</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Purpose</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Cost / Query</th>
              </tr>
            </thead>
            <tbody>
              {modelBreakdown.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-sm text-white">{row.model}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{row.purpose}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-green-400 font-mono">{row.costPerQuery}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Agent Cost */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Per-Agent Cost</h3>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Agent</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Queries</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {agentCosts.map((row) => (
                <tr key={row.agent} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm text-white font-mono">{row.agent}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{row.queries}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-500 font-mono">{row.cost}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Note */}
      <div className="flex items-start gap-3 bg-[#111830] border border-white/[0.06] rounded-xl p-4">
        <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-400">
          Connect MARS analytics APIs to see real data. Cost figures will populate automatically once the analytics pipeline is active.
        </p>
      </div>
    </div>
  );
}
