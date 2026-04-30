"use client";

import type {
  DeprecationState,
  ImpactItem,
  ImpactStatus,
} from "@/types/pr-feed";

interface Props {
  items: ImpactItem[];
  onRowClick: (impact: ImpactItem) => void;
}

const IMPACT_STATUS_CLS: Record<ImpactStatus, string> = {
  impacted: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  eligible_no_change: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  deprecated_skipped: "text-slate-300 bg-slate-500/10 border-slate-500/20",
  new_pending: "text-violet-300 bg-violet-500/10 border-violet-500/20",
};

const DEPRECATION_CLS: Record<DeprecationState, string> = {
  active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  deprecated: "text-rose-300 bg-rose-500/10 border-rose-500/20",
};

function confidenceCls(score: number | null): string {
  if (score === null || score === undefined) return "bg-slate-500";
  if (score >= 0.85) return "bg-emerald-500";
  if (score >= 0.7) return "bg-amber-500";
  return "bg-slate-500";
}

// Phase-25 (Wave-3D) — split impacts by api_status into two visually
// distinct sections. NEW APIs land first (emerald accent — they need
// curator attention before they ship), EXISTING APIs follow (cyan
// accent — already in api_listing, just a regression-impact signal).
// Keeps column shapes + onRowClick wiring identical to the Phase-13
// flat table; rendering is delegated to FlatImpactsTable.
export default function ImpactsTable({ items, onRowClick }: Props) {
  const newApis = items.filter((i) => i.api_status === "new");
  const existingApis = items.filter((i) => i.api_status === "existing");

  if (newApis.length === 0 && existingApis.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-500">
        No impacts match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {newApis.length > 0 && (
        <section>
          <header className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider text-emerald-400">
            NEW APIs
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
              {newApis.length}
            </span>
          </header>
          <FlatImpactsTable items={newApis} onRowClick={onRowClick} />
        </section>
      )}
      {existingApis.length > 0 && (
        <section>
          <header className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider text-cyan-400">
            EXISTING APIs
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
              {existingApis.length}
            </span>
          </header>
          <FlatImpactsTable items={existingApis} onRowClick={onRowClick} />
        </section>
      )}
    </div>
  );
}

// Phase-25 (Wave-3D) — extracted Phase-13 flat-table rendering. Lives as
// an internal helper so the NEW/EXISTING split sections can both reuse
// it with identical column shapes + row interaction.
function FlatImpactsTable({ items, onRowClick }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-500">
          <th className="px-4 py-2 font-medium">Method</th>
          <th className="px-4 py-2 font-medium">Path</th>
          <th className="px-4 py-2 font-medium">Impact</th>
          <th className="px-4 py-2 font-medium">API</th>
          <th className="px-4 py-2 font-medium">Deprecation</th>
          <th className="px-4 py-2 font-medium">Confidence</th>
          <th className="px-4 py-2 font-medium">Changed file</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const impactCls =
            IMPACT_STATUS_CLS[it.impact_status] ||
            "text-slate-300 bg-white/[0.05] border-white/[0.06]";
          const depCls = it.deprecation_state
            ? DEPRECATION_CLS[it.deprecation_state]
            : "text-slate-400 bg-white/[0.05] border-white/[0.06]";
          return (
            <tr
              key={it.id}
              tabIndex={0}
              role="button"
              aria-label={`Open impact detail for ${it.http_method || ""} ${it.http_path}`}
              onClick={() => onRowClick(it)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(it);
                }
              }}
              className="cursor-pointer border-b border-white/[0.03] transition hover:bg-white/[0.02] focus:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-300">
                {it.http_method || "—"}
              </td>
              <td className="max-w-md px-4 py-3 font-mono text-xs text-slate-100">
                <div className="truncate">{it.http_path}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-[11px] capitalize ${impactCls}`}
                >
                  {it.impact_status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-300 capitalize">
                {it.api_status}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-[11px] capitalize ${depCls}`}
                >
                  {it.deprecation_state || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <ConfidenceBar score={it.llm_confidence_score} />
              </td>
              <td className="max-w-xs px-4 py-3 font-mono text-[11px] text-slate-400">
                {(() => {
                  const files =
                    it.contributing_files && it.contributing_files.length > 0
                      ? it.contributing_files
                      : it.changed_source_file
                        ? [it.changed_source_file]
                        : [];
                  if (files.length === 0) {
                    return <div className="truncate">—</div>;
                  }
                  if (files.length === 1) {
                    return <div className="truncate">{files[0]}</div>;
                  }
                  return (
                    <div
                      className="truncate"
                      title={files.join("\n")}
                    >
                      {files[0]}{" "}
                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                        +{files.length - 1}
                      </span>
                    </div>
                  );
                })()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded bg-white/[0.05]">
        <div
          className={`h-full ${confidenceCls(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-400">{pct}%</span>
    </div>
  );
}
