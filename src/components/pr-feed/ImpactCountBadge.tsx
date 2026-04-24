import type { ImpactCounts } from "@/types/pr-feed";

interface Props {
  counts: ImpactCounts;
}

const PILLS: Array<{
  key: keyof ImpactCounts;
  label: string;
  cls: string;
  title: string;
}> = [
  {
    key: "impacted",
    label: "I",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    title: "impacted",
  },
  {
    key: "eligible_no_change",
    label: "E",
    cls: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    title: "eligible, no change",
  },
  {
    key: "deprecated_skipped",
    label: "D",
    cls: "bg-slate-500/15 text-slate-300 border-slate-500/20",
    title: "deprecated, skipped",
  },
  {
    key: "new_pending",
    label: "N",
    cls: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    title: "new pending",
  },
];

export default function ImpactCountBadge({ counts }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      {PILLS.map((p) => {
        const n = counts[p.key] ?? 0;
        return (
          <span
            key={p.key}
            title={`${p.title}: ${n}`}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${p.cls} ${
              n === 0 ? "opacity-40" : ""
            }`}
          >
            <span className="font-semibold">{p.label}</span>
            <span>{n}</span>
          </span>
        );
      })}
    </div>
  );
}
