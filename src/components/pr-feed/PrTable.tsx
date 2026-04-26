"use client";

import { ExternalLink } from "lucide-react";
import type { PrListItem, ProcessingStatus } from "@/types/pr-feed";
import ImpactCountBadge from "./ImpactCountBadge";
import PerRowSyncImpactsButton from "@/components/pr-sync/PerRowSyncImpactsButton";

interface Props {
  items: PrListItem[];
  onRowClick: (prId: number) => void;
}

const STATUS_COLORS: Record<ProcessingStatus, string> = {
  pending: "text-slate-400 bg-white/[0.05]",
  processing: "text-sky-300 bg-sky-500/10",
  done: "text-emerald-300 bg-emerald-500/10",
  failed: "text-rose-300 bg-rose-500/10",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export default function PrTable({ items, onRowClick }: Props) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-500">
        No PRs match the current filters.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-500">
          <th className="px-4 py-2 font-medium">PR #</th>
          <th className="px-4 py-2 font-medium">Title</th>
          <th className="px-4 py-2 font-medium">Author</th>
          <th className="px-4 py-2 font-medium">Merged</th>
          <th className="px-4 py-2 font-medium">Base</th>
          <th className="px-4 py-2 font-medium text-right">Files</th>
          <th className="px-4 py-2 font-medium">Impact</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Sync</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody>
        {items.map((pr) => {
          const statusCls =
            STATUS_COLORS[pr.processing_status] ||
            "text-slate-400 bg-white/[0.05]";
          return (
            <tr
              key={pr.id}
              tabIndex={0}
              role="button"
              aria-label={`Open PR #${pr.pr_number}`}
              onClick={() => onRowClick(pr.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(pr.id);
                }
              }}
              className="cursor-pointer border-b border-white/[0.03] transition hover:bg-white/[0.02] focus:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-300">
                #{pr.pr_number}
              </td>
              <td className="max-w-md px-4 py-3 text-slate-100">
                <div className="truncate">{pr.pr_title || "(untitled)"}</div>
              </td>
              <td className="px-4 py-3 text-slate-300">
                {pr.pr_author || "—"}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {formatDate(pr.merged_at)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">
                {pr.base_branch || "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                {pr.changed_files}
              </td>
              <td className="px-4 py-3">
                <ImpactCountBadge counts={pr.impact_counts} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium capitalize ${statusCls}`}
                >
                  {pr.processing_status}
                </span>
              </td>
              <td
                className="px-4 py-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <PerRowSyncImpactsButton prId={pr.id} />
              </td>
              <td className="px-4 py-3 text-right">
                {pr.pr_url && (
                  <a
                    href={pr.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center text-slate-500 transition hover:text-cyan-400"
                    aria-label={`Open PR #${pr.pr_number} on GitHub`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
