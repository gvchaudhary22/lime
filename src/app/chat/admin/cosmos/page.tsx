"use client";

import { useRouter } from "next/navigation";
import {
  Brain, Zap, Search, Bot, Settings, Code2, ClipboardCheck,
  BarChart3, Gauge, Star, ArrowRight,
} from "lucide-react";

const sections = [
  {
    title: "AI Training & Simulation",
    items: [
      { icon: Brain, label: "Training Pipeline", desc: "Run KB ingestion, embedding, graph build", href: "/chat/admin/cosmos/training", color: "from-green-500 to-emerald-600" },
      { icon: Zap, label: "Simulation", desc: "Test queries with wave-by-wave trace", href: "/chat/admin/cosmos/simulation", color: "from-blue-500 to-cyan-600" },
    ],
  },
  {
    title: "Analytics & Monitoring",
    items: [
      { icon: Search, label: "Query Traces", desc: "View every query execution with wave breakdown", href: "/chat/admin/cosmos/traces", color: "from-purple-500 to-violet-600" },
      { icon: Bot, label: "Agent Dashboard", desc: "18 agents — success rates, handoffs, usage", href: "/chat/admin/cosmos/agents", color: "from-orange-500 to-amber-600" },
      { icon: BarChart3, label: "KB Quality", desc: "Retrieval metrics, eval scores, pillar coverage", href: "/chat/admin/cosmos/kb-quality", color: "from-pink-500 to-rose-600" },
      { icon: Gauge, label: "Cost Analytics", desc: "Token usage, model costs, per-agent breakdown", href: "/chat/admin/cosmos/cost", color: "from-yellow-500 to-orange-600" },
    ],
  },
  {
    title: "Registry (CRUD)",
    items: [
      { icon: Settings, label: "Tool Registry", desc: "Create, edit, disable tools — generate from KB", href: "/chat/admin/cosmos/registry/tools", color: "from-teal-500 to-green-600" },
      { icon: Bot, label: "Agent Registry", desc: "Manage agents — assign tools, set handoffs", href: "/chat/admin/cosmos/agents", color: "from-indigo-500 to-blue-600" },
      { icon: Code2, label: "Skill Builder", desc: "Create skills from actions — set triggers", href: "/chat/admin/cosmos/registry/skills", color: "from-fuchsia-500 to-purple-600" },
      { icon: ClipboardCheck, label: "Action Contracts", desc: "25 actions with execution graphs, preconditions", href: "/chat/admin/cosmos/registry/actions", color: "from-red-500 to-rose-600" },
    ],
  },
  {
    title: "Quality & Feedback",
    items: [
      { icon: Star, label: "Feedback Review", desc: "Approve/reject KB improvements from low-confidence traces", href: "/chat/admin/cosmos/feedback", color: "from-amber-500 to-yellow-600" },
      { icon: Settings, label: "Settings", desc: "Wave config, thresholds, model selection", href: "/chat/admin/cosmos/settings", color: "from-slate-500 to-gray-600" },
    ],
  },
];

export default function CosmosHome() {
  const router = useRouter();

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { value: "7,500+", label: "KB Documents", color: "text-green-400" },
          { value: "25", label: "Action Contracts", color: "text-purple-400" },
          { value: "18", label: "AI Agents", color: "text-blue-400" },
          { value: "8", label: "Workflow Runbooks", color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111830] border border-white/[0.06] rounded-xl p-5 text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{section.title}</h3>
          <div className="grid grid-cols-2 gap-3">
            {section.items.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="bg-[#111830] border border-white/[0.06] rounded-xl p-4 text-left hover:border-purple-500/30 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition-colors" />
                </div>
                <h4 className="text-white font-medium mt-3">{item.label}</h4>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
