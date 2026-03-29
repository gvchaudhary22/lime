"use client";

import { Repository } from "@/lib/api";

// Onboarding stages for progress visualization
const ONBOARDING_STAGES = [
  { key: "cloned", label: "Cloned", description: "Repository cloned to MARS server" },
  { key: "analyzed", label: "Analyzed", description: "Language, framework, modules detected" },
  { key: "templates", label: "Templates", description: "Task API & .claude config pushed" },
  { key: "elk", label: "ELK Config", description: "ELK dashboard URLs configured" },
  { key: "deployed", label: "Deployed", description: "QA branch deployed & verified" },
  { key: "enriched", label: "Enriched", description: "Knowledge enriched via chat" },
];

export function getOnboardingStage(repo: Repository): number {
  if (repo.context_score >= 50) return 6;
  if (repo.backend_health_status === "healthy" || repo.backend_health_status === "up") return 5;
  if (repo.onboarding_status === "completed" || repo.onboarding_status === "complete") return 4;
  if (repo.clone_path) return 3;
  if (repo.onboarding_status === "analyzing") return 2;
  return 1;
}

export function StageProgress({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center gap-1 w-full" role="group" aria-label={`Onboarding progress: stage ${currentStage} of ${ONBOARDING_STAGES.length}`}>
      {ONBOARDING_STAGES.map((stage, idx) => {
        const stageNum = idx + 1;
        const isComplete = stageNum <= currentStage;
        const isCurrent = stageNum === currentStage;
        return (
          <div key={stage.key} className="flex-1 group relative">
            <div
              className={`h-2 rounded-full transition-all ${
                isComplete ? isCurrent ? "bg-purple-500" : "bg-green-500" : "bg-white/[0.08]"
              }`}
              title={`${stage.label}: ${stage.description}`}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1030] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-slate-300 whitespace-nowrap z-10">
              {stage.label}: {stage.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContextScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
  const strokeColor = score >= 70 ? "#4ade80" : score >= 40 ? "#facc15" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={3} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className={`absolute text-xs font-bold ${color}`} aria-label={`Score ${Math.round(score)} out of 100`}>{Math.round(score)}</span>
    </div>
  );
}

export function ModuleScoreBar({ name, score, gaps }: { name: string; score: number; gaps: string[] }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300 truncate flex-1">{name}</span>
        <span className="text-xs text-slate-400 ml-2">{score}/100</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`${name} score: ${score} out of 100`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      {gaps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {gaps.slice(0, 3).map((g) => (
            <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{g}</span>
          ))}
          {gaps.length > 3 && <span className="text-[10px] px-1.5 py-0.5 text-slate-400">+{gaps.length - 3}</span>}
        </div>
      )}
    </div>
  );
}

export function ProfileTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-[10px] text-slate-500 block">{label}</span>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
