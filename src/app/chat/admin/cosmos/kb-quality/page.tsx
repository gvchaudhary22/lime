"use client";

import { Database, GitBranch, Link2, Target } from "lucide-react";

const stats = [
  { label: "Total Docs", value: "7,500", icon: Database, color: "text-green-400" },
  { label: "Graph Nodes", value: "6,661", icon: GitBranch, color: "text-blue-400" },
  { label: "Graph Edges", value: "39,745", icon: Link2, color: "text-purple-400" },
  { label: "Eval Score", value: "85%", icon: Target, color: "text-orange-400" },
];

interface Pillar {
  id: string;
  name: string;
  detail: string;
  count: string;
  quality: number;
  color: string;
}

const pillars: Pillar[] = [
  { id: "P1", name: "Schema", detail: "676 tables extracted", count: "676", quality: 95, color: "bg-green-500" },
  { id: "P3", name: "APIs", detail: "5,617 endpoints documented", count: "5,617", quality: 88, color: "bg-blue-500" },
  { id: "P4", name: "Pages", detail: "24 pages (20+ fields each)", count: "24", quality: 92, color: "bg-purple-500" },
  { id: "P5", name: "Modules", detail: "713 modules (21/21 ready)", count: "713", quality: 97, color: "bg-cyan-500" },
  { id: "P6", name: "Actions", detail: "275 files (25 actions)", count: "275", quality: 85, color: "bg-orange-500" },
  { id: "P7", name: "Workflows", detail: "104 files (8 workflows)", count: "104", quality: 82, color: "bg-pink-500" },
  { id: "P8", name: "Negatives", detail: "100 negative examples", count: "100", quality: 78, color: "bg-red-500" },
  { id: "Hub", name: "Entity Hubs", detail: "10 entity relationship hubs", count: "10", quality: 90, color: "bg-teal-500" },
];

export default function KBQualityPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pillar Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Pillar Breakdown</h3>
        <div className="bg-[#111830] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Pillar</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Details</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Count</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3 w-64">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {pillars.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-bold text-white bg-white/[0.06] px-2 py-1 rounded font-mono">
                      {p.id}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-white">{p.name}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{p.detail}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-white font-mono">{p.count}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[#0a0e1a] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.color} transition-all`}
                          style={{ width: `${p.quality}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-8 text-right ${
                        p.quality >= 90 ? "text-green-400" : p.quality >= 80 ? "text-yellow-400" : "text-orange-400"
                      }`}>
                        {p.quality}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overall Coverage */}
      <div className="bg-[#111830] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Overall KB Coverage</span>
          <span className="text-sm font-bold text-green-400">
            {Math.round(pillars.reduce((s, p) => s + p.quality, 0) / pillars.length)}%
          </span>
        </div>
        <div className="w-full h-3 bg-[#0a0e1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
            style={{
              width: `${Math.round(pillars.reduce((s, p) => s + p.quality, 0) / pillars.length)}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-slate-600">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
