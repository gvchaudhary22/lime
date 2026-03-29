"use client";

interface TierBadgeProps {
  stage?: string;
}

export default function TierBadge({ stage }: TierBadgeProps) {
  if (!stage) return null;

  const isClaude = stage === "claude";

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ml-2 ${
        isClaude
          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
      }`}
    >
      {isClaude ? "Claude" : "AI Gateway"}
    </span>
  );
}
