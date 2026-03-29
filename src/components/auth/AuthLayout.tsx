"use client";

import AnimatedBackground from "./AnimatedBackground";
import { Truck, Package, Rocket, Zap } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#0c0515]">
      {/* Left side — Branding + Animated background */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between py-12 px-14">
        <AnimatedBackground />

        {/* Top — Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 via-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">
              MARS
            </span>
          </div>
        </div>

        {/* Middle — Hero text */}
        <div className="relative z-10 -mt-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-purple-400/60" />
            <span className="text-sm font-medium text-purple-300/90 uppercase tracking-[0.2em]">
              Shiprocket Engineering
            </span>
          </div>

          <h1 className="text-5xl font-bold text-white leading-[1.15] mb-5">
            AI-Powered
            <br />
            <span className="bg-gradient-to-r from-purple-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Logistics Intelligence
            </span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed max-w-lg mb-8">
            One platform to resolve incidents, debug issues, and ship features
            across{" "}
            <span className="text-purple-300 font-medium">25+ repositories</span>{" "}
            — powered by contextual AI agents.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: Zap, label: "Instant RCA" },
              { icon: Package, label: "eCommerce Context" },
              { icon: Truck, label: "Logistics AI" },
              { icon: Rocket, label: "Multi-Repo" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-purple-400/[0.1] bg-purple-500/[0.05] backdrop-blur-sm"
              >
                <Icon className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — Metrics strip */}
        <div className="relative z-10 flex items-center gap-8">
          {[
            { value: "25+", label: "Repositories" },
            { value: "< 30s", label: "Avg Resolution" },
            { value: "24/7", label: "AI Monitoring" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side — Auth form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center px-6 sm:px-12 lg:px-16 bg-[#100820]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
