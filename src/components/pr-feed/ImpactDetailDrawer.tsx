"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ImpactItem } from "@/types/pr-feed";

interface Props {
  impact: ImpactItem | null;
  onClose: () => void;
}

export default function ImpactDetailDrawer({ impact, onClose }: Props) {
  useEffect(() => {
    if (!impact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [impact, onClose]);

  if (!impact) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Impact detail for ${impact.http_path}`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-white/[0.06] bg-[#0a0f1e] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="font-mono text-xs text-slate-500">
              #{impact.id}
            </div>
            <div className="mt-0.5 font-mono text-sm text-slate-100">
              {impact.http_method} {impact.http_path}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          <Section label="Impact description">
            <p
              data-testid="drawer-description"
              className="whitespace-pre-wrap text-slate-200"
            >
              {impact.llm_impact_description || "—"}
            </p>
          </Section>

          <Section label="Changed functions">
            {impact.llm_changed_functions &&
            impact.llm_changed_functions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {impact.llm_changed_functions.map((fn) => (
                  <span
                    key={fn}
                    className="rounded border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-200"
                  >
                    {fn}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </Section>

          <Section label="Source files">
            <DetailKV label="Changed" value={impact.changed_source_file} mono />
            {impact.contributing_files &&
              impact.contributing_files.length > 1 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Contributing files ({impact.contributing_files.length})
                  </div>
                  <ul className="mt-1 flex flex-col gap-1 font-mono text-[11px] text-slate-300">
                    {impact.contributing_files.map((f) => (
                      <li key={f} className="truncate">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            <DetailKV
              label="Indirect file"
              value={impact.indirect_file_path}
              mono
            />
            <DetailKV label="KB file" value={impact.kb_file_path} mono />
          </Section>

          <Section label="Metadata">
            <DetailKV label="Impact type" value={impact.impact_type} />
            <DetailKV label="Impact status" value={impact.impact_status} />
            <DetailKV label="API status" value={impact.api_status} />
            <DetailKV
              label="Deprecation state"
              value={impact.deprecation_state || "—"}
            />
            <DetailKV label="Platform" value={impact.platform || "—"} />
            <DetailKV label="Module" value={impact.domain || "—"} />
            <DetailKV
              label="LLM confidence"
              value={
                impact.llm_confidence_score !== null
                  ? impact.llm_confidence_score.toFixed(2)
                  : "—"
              }
            />
            <DetailKV label="LLM model" value={impact.llm_model || "—"} />
            <DetailKV label="KB populated" value={String(impact.kb_populated)} />
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </h4>
      {children}
    </section>
  );
}

function DetailKV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 py-0.5 text-xs">
      <span className="min-w-[120px] text-slate-500">{label}</span>
      <span
        className={`flex-1 text-slate-200 ${mono ? "font-mono text-[11px] break-all" : "capitalize"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}
