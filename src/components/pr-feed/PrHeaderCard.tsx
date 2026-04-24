import { ExternalLink } from "lucide-react";
import type { PrDetailHeader, ProcessingStatus } from "@/types/pr-feed";

interface Props {
  pr: PrDetailHeader;
}

const STATUS_COLORS: Record<ProcessingStatus, string> = {
  pending: "text-slate-400 bg-white/[0.05]",
  processing: "text-sky-300 bg-sky-500/10",
  done: "text-emerald-300 bg-emerald-500/10",
  failed: "text-rose-300 bg-rose-500/10",
};

export default function PrHeaderCard({ pr }: Props) {
  const statusCls =
    STATUS_COLORS[pr.processing_status] || "text-slate-400 bg-white/[0.05]";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-1 flex items-center gap-3">
        <span className="font-mono text-xs text-slate-500">
          #{pr.pr_number}
        </span>
        <span
          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium capitalize ${statusCls}`}
        >
          {pr.processing_status}
        </span>
        {pr.pr_url && (
          <a
            href={pr.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-cyan-400"
          >
            open on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <h2 className="text-lg font-semibold text-slate-100">
        {pr.pr_title || "(untitled)"}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400 md:grid-cols-4">
        <Field label="Author" value={pr.pr_author || "—"} />
        <Field label="Merged at" value={pr.merged_at || "—"} />
        <Field label="Merged by" value={pr.merged_by || "—"} />
        <Field label="Base branch" value={pr.base_branch || "—"} mono />
        <Field label="Head branch" value={pr.head_branch || "—"} mono />
        <Field label="Changed files" value={String(pr.changed_files)} />
        <Field
          label="Approved by"
          value={
            pr.approved_by && pr.approved_by.length > 0
              ? pr.approved_by.join(", ")
              : "—"
          }
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-slate-500">{label}</span>
      <span
        className={`text-slate-200 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
