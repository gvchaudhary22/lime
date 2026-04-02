"use client";

import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import {
  Brain, Zap, Search, Bot, Settings, Code2, ClipboardCheck,
  BarChart3, Gauge, Star,
} from "lucide-react";

const tabs = [
  { icon: Brain, label: "Training", href: "/chat/admin/cosmos/training" },
  { icon: Zap, label: "Simulation", href: "/chat/admin/cosmos/simulation" },
  { icon: Search, label: "Query Traces", href: "/chat/admin/cosmos/traces" },
  { icon: Bot, label: "Agents", href: "/chat/admin/cosmos/agents" },
  { icon: Settings, label: "Tools", href: "/chat/admin/cosmos/registry/tools" },
  { icon: Code2, label: "Skills", href: "/chat/admin/cosmos/registry/skills" },
  { icon: ClipboardCheck, label: "Actions", href: "/chat/admin/cosmos/registry/actions" },
  { icon: BarChart3, label: "KB Quality", href: "/chat/admin/cosmos/kb-quality" },
  { icon: Gauge, label: "Cost", href: "/chat/admin/cosmos/cost" },
  { icon: Star, label: "Feedback", href: "/chat/admin/cosmos/feedback" },
  { icon: Settings, label: "Settings", href: "/chat/admin/cosmos/settings" },
];

export default function CosmosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-screen bg-[#0a0e1a]">
      <Sidebar activePage="cosmos" />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-[#0c0515]/80 backdrop-blur-sm">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              COSMOS — RocketMind AI Platform
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Knowledge Base &middot; Agents &middot; Tools &middot; Skills &middot; Actions &middot; Analytics
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="px-4 flex gap-1 overflow-x-auto pb-0 scrollbar-thin">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? "text-purple-300 border-purple-400 bg-purple-500/10"
                      : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
